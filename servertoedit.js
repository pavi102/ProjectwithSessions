const utils = require('./server_utils/mongo_util.js');
const express = require('express');
const session = require('express-session');
const hbs = require('hbs');
const bodyParser = require('body-parser');
const fs = require('fs');
const bcryptjs = require('bcryptjs');
const expressValidator = require('express-validator');
var ObjectId = require('mongodb').ObjectID;
const MongoDBStore = require('connect-mongodb-session')(session);
var app = express();

app.use(expressValidator());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

var store = new MongoDBStore({
    uri: 'mongodb+srv://admin:mongodb@agileproject-qha9t.mongodb.net/projectdb?retryWrites=true',
    collection: 'mySessions'
});

const {
    PORT = 8080,
    NODE_ENV = 'development',
    SESS_NAME = 'sid',
    SESS_SECRET = 'ssh!quiet,it\'asecrat!',
} = process.env;



const IN_PROD = NODE_ENV === 'production';


app.use(session({
    name: SESS_NAME,
    resave: false,
    saveUninitialized: false,
    secret: SESS_SECRET,
    store: store,
    cookie: {
        sameSite: true,
        proxy: true,
        maxAge: 1000 * 60 * 60 * 24 * 2, //two days
        secure: false,
        httpOnly: false
    }
}));


//Needed to use partials folder
hbs.registerPartials(__dirname + '/views/partials');

//Helpers
hbs.registerHelper('getCurrentYear', () => {
    return new Date().getFullYear();
});


//Helpers End


app.set('view engine', 'hbs');
app.use(express.static(__dirname + '/views'));

const redirectLogin = (req, res, next) => {
    if (!req.session.userId) {
        console.log('This redirects Login');
        res.redirect('/')
    }else{
        next()
    }
};

const redirectHome = (req, res, next) => {
    if (req.session.userId) {
        console.log('This redirects Home');
        res.redirect('/home')
    }else{
        next()
    }
};



app.get('/my_cart', redirectLogin, (request, response) => {
    var db = utils.getDb();

    db.collection('Accounts').find({email: `${request.session.userId}`}).toArray((err, docs)=>{
        if (err){
            response.render('404.hbs',{
                error: "Cannot connect to database"
            })
        }
        var cart_list = [];
        var total = 0;
        for (var i = 0; i < docs[0].cart.length; i+=1){
            total = total + (docs[0].cart[i].price * docs[0].cart[i].quantity)
        }
        for (var i = 0; i < docs[0].cart.length; i+= 1) {
            cart_list.push(docs[0].cart.slice(i, i + 1));
        }
        response.render('my_cart.hbs',{
            products: cart_list,
            total_price: total,
            username: request.session.userId
        })
    });
});

//
//Shop page


app.get('/shop', redirectLogin, (request, response) => {

    var db = utils.getDb();
    db.collection('Shoes').find({}).toArray((err, docs) => {
        if (err) {
            response.render('404.hbs', { error: "Unable to connect to database" })
        }
        if (!docs){
            throw err;
        }
        db.collection("Accounts").findOne({email: request.session.userId}, (err, result) => {
            response.render('shop.hbs',{
                itemerror: false,
                admin: result.isAdmin,
                products: docs,
                username: request.session.userId
            })

        });

    });
});

//
//Shop page end

app.get('/',(req, res) => {
    //const { userId} = req.session.userId
    if('userId' in req.session){
        res.redirect('/home')
        // res.render('home.hbs',{
        //     username: req.session.userId
        // })
    }else {
        // console.log(req.session);
        res.render('homenotlog.hbs')
    }

    // res.render(`${userId ? `home.hbs` : `homenotlog.hbs`}`, {
    //     username: req.session.userId
    // })

});


app.get('/home', redirectLogin, (req, res) => {
    // const { user } = res.locals;
    res.render('home.hbs', {
        username: req.session.userId
    })
});

app.post('/login', redirectHome, (req, res) => {
    var db = utils.getDb();
    db.collection('Accounts').find({email: `${req.body.email}`}).toArray().then(function (feedbacks) {
        if (feedbacks.length === 0) {
            res.location('/');
            res.render('homenotlog.hbs', {
                error: true,
                login_message: "Account does not exist"
            })
        } else {
            if(bcryptjs.compareSync(req.body.pwd, feedbacks[0].pwd)) {
                req.session.userId = feedbacks[0].email;
                // console.log(`${req.session.userId} logged in`);
                return res.redirect('/home')

            }else{
                res.render('homenotlog.hbs', {
                    error: true,
                    login_message: "Incorrect password, try again"
                })
            }
        }
    });
});


app.post('/register', redirectHome, (req, res) => {
    var db = utils.getDb();
    db.collection('Accounts').find({email: `${req.body.email}`}).toArray().then(function (feedbacks) {
        if (feedbacks.length === 0) {
            if(req.body.pwd === req.body.pwd2) {
                delete req.body._id; // for safety reasons
                let salt = undefined;
                bcryptjs.genSalt(10, (err, result) => {
                    if (err)
                        console.log(err);
                    salt = result;
                });
                db.collection('Accounts').insertOne({
                    email: req.body.email,
                    pwd: bcryptjs.hashSync(req.body.pwd, salt),
                    cart: [],
                    history: []
                });
                req.session.userId = req.body.email;
                return res.redirect('/home')
            }else{
                res.render('homenotlog.hbs',{
                    signup_error: true,
                    signup_message : "Passwords do not match"
                })
            }
        } else {
            res.render('homenotlog.hbs',{
                signup_error: true,
                signup_message : "Account name already exists"
            })
        }
    })
});



app.get('/logout', redirectLogin, (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/')
        }
        res.clearCookie(SESS_NAME);
        res.redirect('/')
    })
});

app.get('/404', (request, response) => {
    response.render('404', {
        error: "Cannot connect to the server."
    })
});


//Route to add to cart

app.post('/add-to-cart', redirectLogin,(request, response)=> {
    //read from user_info to get _id,
    var db = utils.getDb();
    var userID = request.session.userId;
    var productId = request.body.objectid;
    let quantity = request.body.quantity || 1;

    db.collection('Shoes').findOne( { _id : ObjectId(productId) }, (err, doc) => {
        if (err) {
            throw err;
        }
        if (!doc){
            response.render('404',{
                error: "Cannot connect to database"
            })
        }else{
            db.collection('Accounts').find({email: request.session.userId, "cart.item_id": doc._id}).toArray( (err, document)=>{
                if (err){
                    response.render('404.hbs',{
                        error: "Cannot connect to database"
                    })
                }
                if (document.length === 0){
                    db.collection('Accounts').updateOne({"email": request.session.userId},
                        {
                            $push: {
                                "cart": {
                                    item_id: doc._id,
                                    name: doc.name,
                                    path: doc.path,
                                    price: doc.price,
                                    quantity: quantity
                                }
                            }
                        });
                }else if(document.length === 1){
                    db.collection('Accounts').updateOne({"email": request.session.userId, "cart.item_id": doc._id},
                        {
                            $inc: {
                                "cart.$.quantity": quantity
                            }
                        })
                }
            });
            setTimeout(function () {
                response.redirect('/shop')
            }, 3000);
        }
    })
});

app.post('/delete-item', redirectLogin, (request, response)=> {
    var cart_item_id = request.body.item_id;
    var number = Number(request.body.remove_num);
    var db = utils.getDb();
    db.collection('Accounts').findOne({email: request.session.userId, "cart.item_id": ObjectId(cart_item_id)}, (err, document)=>{
        if (err){
            response.render('404.hbs',{
                error: "Cannot connect to database"
            })
        }
        var cart_string = JSON.stringify(document.cart, undefined, indent=4);
        var cart = JSON.parse(cart_string);

        //Loops through account cart for the right product id
        for (var i = 0; i < cart.length; i++){

            if (cart[i].item_id === cart_item_id){
                // If quantity is lower than or equal to 0, pull the product from the cart array
                if (cart[i].quantity - number <= 0){
                    db.collection('Accounts').findOneAndUpdate({email: request.session.userId},
                        { $pull: {cart: {item_id: ObjectId(cart_item_id)}} }
                    )
                }else{
                    db.collection('Accounts').findOneAndUpdate({email: request.session.userId, "cart.item_id": ObjectId(cart_item_id)},{
                        $inc: {
                            "cart.$.quantity": -`${number}`
                        }
                    });
                }
            }
        }

            response.redirect('/my_cart');
    });
});

app.post("/addProduct", (req, res) => {
    utils.getDb().collection("Accounts").findOne({email: req.session.userId}, (err, result) => {
        if (result.isAdmin) {
            let name = req.body.name;
            let type = req.body.type;
            let color = req.body.color;
            let price = req.body.price;
            let image = req.body.image;
            let description = req.body.description;
            utils.getDb().collection("Shoes").insertOne(
                {
                    name: name,
                    type: type,
                    color: color,
                    price: price,
                    path: image,
                    description: description
                }, function (err, result1) {
                    if (err)
                        console.log(err);
                    else
                        setTimeout(function () {
                            res.redirect("/shop");
                        }, 2000);
                });

        } else
            res.redirect("/");
    });
});

app.get("/db", (req, res) => {

    utils.getDb().collection("Accounts").find().toArray((err, result) => {
        console.log(result)
    });
    res.redirect("/")
});

app.post('/registerAdmin', (req, res) => {

    var db = utils.getDb();
    db.collection('Accounts').find({email: `${req.body.email}`}).toArray().then(function (feedbacks) {
        if (feedbacks.length === 0) {
            if(req.body.pwd === req.body.pwd2) {
                delete req.body._id; // for safety reasons
                let salt = undefined;
                bcryptjs.genSalt(10, (err, result) => {
                    if (err)
                        console.log(err);
                    salt = result;
                });
                db.collection('Accounts').insertOne({
                    email: req.body.email,
                    pwd: bcryptjs.hashSync(req.body.pwd, salt),
                    isAdmin: true,
                    cart: []
                });
                req.session.userId = req.body.email;
                return res.redirect('/home')
            }else{
                res.render('homenotlog.hbs',{
                    admin_error: true,
                    admin_message : "Passwords do not match"
                })
            }
        } else {
            res.render('homenotlog.hbs',{
                admin_error: true,
                admin_message : "Account already exists"
            })
        }
    })
});

app.post("/addProduct", (req, res) => {
    utils.getDb().collection("Accounts").findOne({email: req.session.userId}, (err, result) => {
        if (result.isAdmin) {
            let name = req.body.name;
            let type = req.body.type;
            let color = req.body.color;
            let price = req.body.price;
            let image = req.body.image;
            let description = req.body.description;

            utils.getDb().collection("Shoes").insertOne(
                {
                    name: name,
                    type: type,
                    color: color,
                    price: price,
                    path: image,
                    description: description

                }, function (err, result1) {
                    if (err)
                        console.log(err);
                    else
                        res.redirect('/shop');
                });

        } else
            res.redirect("/");
    });
});

app.get("/db", (req, res) => {
    utils.getDb().collection("Shoes").find().toArray((err, result) => {
        console.log(result)
    });
    res.redirect("/")
});

app.post("/updateProduct/:id", (req, res) => {
    let db = utils.getDb();
    db.collection('Shoes').updateOne({_id: ObjectId(req.params.id)}, {
        $set: {
            path: req.body.image,
            type: req.body.type,
            name: req.body.name,
            color: req.body.color,
            price: req.body.price,
            description: req.body.description
        }
    }, function (err, result) {
        if(err)
            console.log(err);
        else
            res.redirect('/shop')
    })
});

app.post('/deleteProduct/:id', (req, res) => {
    var db = utils.getDb();
    db.collection('Shoes').findOneAndDelete({_id: ObjectId(req.params.id)}, function (err, result) {
        if (err)
            console.log(err);
        else
            res.redirect("/shop")
    })
});

app.get("/product/:id", (req, res) => {
    let db = utils.getDb();
    db.collection('Shoes').findOne({_id: ObjectId(req.params.id)}, function (err, result) {
        if(err)
            console.log(err);
        else{
            db.collection('Accounts').findOne({email: req.session.userId}, function (err, result1) {
                if(err)
                    console.log(err);
                else {
                    res.render("productPage.hbs", {
                        product: result,
                        username: req.session.userId,
                        admin: result1.isAdmin

                    })
                }
            });
        }
    })
});

// Checkout method for week 3
app.post('/checkout', (req,res)=>{
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime = date+' '+time;
    var db = utils.getDb();
    db.collection('Accounts').findOne({email: req.session.userId}, (err, document)=>{

        var history = {};
        history['date'] = dateTime;
        history['items'] = document.cart;
        db.collection('Accounts').findOneAndUpdate({email: req.session.userId},
            {
                $push: {history: history}
            });
        db.collection('Accounts').findOneAndUpdate({email: req.session.userId},
            { $set: {cart: []}})
    });
    setTimeout(function () {
        res.render('my_cart.hbs',{
        purchase: true,
        username: req.session.userId
    })
    }, 3000);
});

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
    utils.init();
});

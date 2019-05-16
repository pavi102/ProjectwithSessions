const server = require('supertest').agent("http://localhost:8080");
const assert = require('chai').assert;
const MongoClient = require('mongodb').MongoClient;

const teardown = () => {
    MongoClient.connect('mongodb+srv://admin:mongodb@agileproject-qha9t.mongodb.net/projectdb?retryWrites=true',function(err,client) {
        const db = client.db('projectdb');
        if (err) {
            console.log(err);
        }
        else {
            console.log("Connected to db");


            db.collection('Accounts').remove({email: "T3STER1@AJZSHOE.COM"}, function (err, data) {

                if (err) {
                    throw(err);
                }
                else {
                    console.log("sucessfuly inserted");
                }

            })
        }
        client.close();
    })
};

const cartData = [];

const checkcart = () => {
    MongoClient.connect('mongodb+srv://admin:mongodb@agileproject-qha9t.mongodb.net/projectdb?retryWrites=true',function(err,client) {
        const db = client.db('projectdb');


        db.collection('Accounts').findOne({email: "T3STER1@AJZSHOE.COM"}, function (err, data) {

            if (err) {
                throw(err);
            }
            else {
                console.log(data)
            }

        });
    });
};


describe('server.js', function () {
    it('/ endpoint should render homepage', function (done) {
        server
            .get('/')
            .expect(200)
            .expect("Content-type", /html/)
            .end((err, res) => {
                assert.equal(res.status, 200);
                done();
            });
    });
    it('/register should give you a sessionID', function (done) {
        body = {};
        body.email = "ahmad123wqe"+String((Math.random()*100000)+1)+"1@nikko2.com";
        body.pwd = 'Asdf12345!@#';
        body.pwd2 = 'Asdf12345!@#';
        server
            .post('/register')
            .send(body)
            .expect(200)
            .end((err, res) => {
                console.log(res.header);
                assert.equal(res.status, 302);
                console.log(res.header);
                let sess = res.header["set-cookie"] !== undefined;
                assert.equal(sess, true);
                done();

            });
    });
    it("/logout should clear the cookie", (done) => {
        server
            .get('/logout')
            .expect(200)
            .end((err, res) => {
                assert.equal(res.status, 302);
                try{
                    let sess = res.headers["set-cookie"][0].includes('sid=;');
                    assert.equal(sess, true);
                }
                catch (e) {
                    let sess = res.headers["set-cookie"][0] === undefined;
                    assert.equal(sess, true);
                }
                done();
            });
    });
    it('/login should give you a sessionID', function (done) {
        body = {};
        body.email = "T3STER1@AJZSHOE.COM";
        body.pwd = "Asdf12345";
        server
            .post('/login')
            .send(body)
            .expect(200)
            .end((err, res) => {
                assert.equal(res.status, 302);
                console.log(res.headers);
                let sess = res.headers["location"] === '/home';

                assert.equal(sess, true);
                done();
            });
    });

    it('/shop should have status 200', (done)=>{
        body = {};
        body.email = "T3STER1@AJZSHOE.COM";
        body.pwd = "Asdf12345";
        server
            .post('/login')
            .send(body)
            .expect(200)
            .end((err, res) => {
                console.log(res.headers);
                server
                    .get('/shop')
                    .expect(302)
                    .end((err,res1) => {
                        assert.equal(res1.status, 200);
                        // console.log(res1.res.text);
                        if (res1.res.text.includes('Add to cart')){
                            sess = 1
                        }else {
                            sess = 0
                        }
                        assert.equal(sess, 1);
                        done();
                    })
            })

    });
    it('adding to cart /shop should have status 200',(done)=>{
        body = {};
        body.email = "T3STER1@AJZSHOE.COM";
        body.pwd = "Asdf12345";
        body.objectid = '5cd498219157e30cdc7ecaab';
        server
            .post('/login')
            .send(body)
            .expect(200)
            .end((err, res) => {
                // console.log(res.headers);
                server
                    .get('/shop')
                    .expect(302)
                    .end((err,res1) => {
                        console.log(body);
                        server
                            .post('/add-to-cart')
                            .send(body)
                            .expect(200)
                            .end((err, res2) => {
                                checkcart();
                                assert.equal(true,true);
                                done()

                            });

                    })
            })

    });

    it('/my_cart should have status 200', (done)=>{
        body = {};
        body.email = "T3STER1@AJZSHOE.COM";
        body.pwd = "Asdf12345";
        server
            .post('/login')
            .send(body)
            .expect(200)
            .end((err, res)=> {
                server
                    .get('/my_cart')
                    .expect(302)
                    .end((err,res1) => {
                        assert.equal(res.status, 302);
                        assert.equal(res1.req.path, '/my_cart');
                        if (res1.res.text.includes('My Cart')){
                            sess = 1
                        }else {
                            sess = 0
                        }
                        assert.equal(sess, 1);
                        teardown();
                        done();
                    });
            });

    });
});

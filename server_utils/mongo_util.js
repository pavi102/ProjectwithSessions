const MongoClient = require('mongodb').MongoClient;

var _db = null;

module.exports.getDb  = () => {
    return _db;
};

module.exports.init = function(callback) {

    MongoClient.connect('mongodb+srv://admin:mongodb@agileproject-qha9t.mongodb.net/projectdb?retryWrites=true', function(err, client) {
        if (err) {
            return console.log("Unable to connect to DB");
        }
        _db = client.db('projectdb');
        console.log("Successfully connected to MongoDB server");

    });

};

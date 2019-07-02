var mongoose = require('mongoose');
var forms = require('./forms');

var userSchema = new mongoose.Schema({
    username: String,
    password: String,

    myForms:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "forms"
    }]
});

module.exports = mongoose.model('user', userSchema);
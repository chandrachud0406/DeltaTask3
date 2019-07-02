var mongoose = require('mongoose');
var questions = require('./questions');

var formSchema = new mongoose.Schema({
    title: String,
    desc: String,
    totalq: { type: Number,default: 1},
    questions:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: "questions",
        default: []
    }],
    filledUsers: [String]
});

module.exports = mongoose.model('forms', formSchema);
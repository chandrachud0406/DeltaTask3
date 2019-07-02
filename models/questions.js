var mongoose = require('mongoose');

var questionSchema = new mongoose.Schema({
    question: String,
    answerType: String,
    position: Number,
    answer: [mongoose.Schema.Types.Mixed],
    options :[String],
    optionCount : [Array]
});

module.exports = mongoose.model('questions', questionSchema);
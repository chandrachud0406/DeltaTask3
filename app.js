var express = require('express');
var app = express();
var session = require('express-session');
var connectFlash = require('connect-flash');
var fillingForm;

//set up template engine
app.set('view engine',  'ejs');

//static files
app.use(express.static('./public'));

var bodyParser = require('body-parser');
var mongoose = require('mongoose');

//Algorithm for hashing
var bcrypt = require('bcrypt');
var saltRounds = 10;

//Imported Schemas
var User = require('./models/users');
var Form = require('./models/forms');
var Ques = require('./models/questions');

mongoose.Promise = global.Promise;

//Connect to database
mongoose.connect('mongodb://localhost/formsapp',  
{ useNewUrlParser: true , 
useCreateIndex:true,
useFindAndModify: false} );

console.log('Forms app server started');
var urlEncodedParser = bodyParser.urlencoded({extended: false});

//set up a session
app.use(session({
    secret: 'random-secret',
    resave: false,
    saveUninitialized: true,
}));

app.use(connectFlash());

//=====================================================
//Managing login/signup/logout system
//=====================================================

//Home page
app.get('/', function(req, res){
    res.render('home');
});

//Signup page
app.get('/signup', function(req, res){
    res.render('signup', {message: req.flash('info')});
});

//Login page
app.get('/login', function(req, res){
    res.render('login', {message: req.flash('info')});
});

//Logout page
app.get('/logout', function(req, res){

    req.session.user = "";
    res.redirect('/');
});

//to Create a new user with hashed password
app.post('/signup', urlEncodedParser, function(req, res){
    //console.log(req.body);

    User.findOne({username: req.body.username}).exec().then(function(usercheck){

        if(usercheck === null) {
            var userPassword = req.body.password;
            bcrypt
                .genSalt(saltRounds)
                .then(salt => {
      //          console.log(`Salt: ${salt}`);
            
                return bcrypt.hash(userPassword, salt);
                })
                .then(hash => {
        //        console.log(`Hash: ${hash}`);
                req.session.redirectTo = '';
          //      console.log(req.session);
                var newUser = new User({username: req.body.username, password:hash});
                newUser.save(function(err){
                    if (err) throw err;
                });
                })
                .catch(err => console.error(err.message));
                res.redirect('/login');
        }
        else {
            req.flash('info', 'username already exists');
            res.redirect('signup');
        }
    });
});


//login verification
app.post('/login', urlEncodedParser, function(req, res){
  //  console.log(req.body);
    var loginUsername = req.body.username;
    var loginPassword = req.body.password;
    User.findOne({username: loginUsername}).exec().then(function(user){

        if(user !== null) {
            bcrypt
            .compare(loginPassword, user.password)
            .then(bool => {
                if(bool) {
                    var sess = req.session;
                    sess.user = user;
                    var redirectTo = req.session.redirectTo || '';
                    delete req.session.redirectTo;

                    //console.log(req.session);

                    if(redirectTo === '')
                        res.redirect('dashboard');

                    else
                        res.redirect(redirectTo)
                }
                else {
                    req.flash('info', 'Incorrect password');
                    res.redirect('login');
                }
            })
            .catch(err => console.error(err.message));
        }

        else{
            req.flash('info', "Username doesn't exist. Create new account here");
            res.redirect('/signup');
        }
    });

});

//Middleware to check whether the user has logged in
function isLoggedIn(req,res,next){
    if(req.session.user && req.session.user != "")
      next();
    else{
        console.log('error no login');
        res.redirect("/login");  
    }
}

//=================================================
//Dashboard to create/edit/delete forms
//=================================================

//Dashboard Page
app.get('/dashboard', isLoggedIn, function(req, res) {
    
    var sess = req.session;

    var currentUserID = sess.user._id;
    //console.log(currentUserID);
    User.findById(currentUserID).populate("myForms").exec().then(function(user){
            //console.log(user);
            res.render('dashboard', {user: user} );
    }).catch(function(err){
        if(err)
        console.log(err);
    })
});


//Edit form page
app.get('/form/edit/:id', isLoggedIn, function(req, res){
    console.log('edited form');

    var sess = req.session;
    var currentUser = sess.user;

    Form.findById(req.params.id).populate("questions").exec().then(function(currentForm){
  //     console.log(currentForm);
       res.render('editforms', {form: currentForm});
    }).catch(function(err){
       console.log(err);
    })    

});

//delete form
app.get('/form/delete/:id', isLoggedIn, function(req, res){
    console.log("deleted form");
    
    var sess = req.session;
    var currentUser = sess.user;
    var currentUserID = currentUser._id;

    User.findById(currentUserID).exec().then(function(user){

        user.myForms.pull(req.params.id);
        user.save().then(function(){
            res.redirect('back');
        })
    }).catch(function(err){
        console.log(err);
    })
});

//create form and redirect to edit page
app.get('/form/create/', isLoggedIn, function(req, res){

    Form.create({title: "Form title", desc: "Form Desc",question:[]}).then(function(newForm){
        var currentUser = req.session.user;
        var currentUserID = currentUser._id;

        return User.findById(currentUserID).then(function(user){

            user.myForms.push(newForm._id);
            user.save().then(function(){

                res.redirect('/form/edit/' + newForm._id);
            })
        })
    }).catch(function(err){
        console.log(err);
    })
});

//====================================================
//Create/Delete/Save questions
//====================================================

//save form's question edits
app.post('/form/:fid/edit/save', urlEncodedParser, isLoggedIn, function(req, res){
    console.log('changes saved');
//    console.log(req.body);

    Form.findById(req.params.fid).populate("questions").exec().then(async function(form){
        form.title = req.body.title;
        form.desc = req.body.desc;

        var k = 0;
        for(let i = 1; i <= req.body.qn0.length; i++) {
            form.questions[i-1].question = req.body.qn0[i-1];

    
            if (Array.isArray(req.body.qn1) === false ){
                if(form.questions[i-1].answerType === "checkbox" || form.questions[i-1].answerType === "radio") {
                    if(form.questions[i-1].options.length === 0) {
                        form.questions[i-1].options.push(req.body.qn1);
                        form.questions[i-1].options.push(req.body.qn2);
                        form.questions[i-1].options.push(req.body.qn3);
                        form.questions[i-1].options.push(req.body.qn4);
                    }

                    if(form.questions[i-1].options.length !== 0) {
                        form.questions[i-1].options[0] = req.body.qn1;
                        form.questions[i-1].options[1] = req.body.qn2;
                        form.questions[i-1].options[2] = req.body.qn3;
                        form.questions[i-1].options[3] = req.body.qn4;
                    }

                }
            }

            else if(Array.isArray(req.body.qn1) === true ) {
                if(form.questions[i-1].answerType === "checkbox" || form.questions[i-1].answerType === "radio") {
                    if(form.questions[i-1].options.length === 0) {
                        form.questions[i-1].options.push(req.body.qn1[k]);
                        form.questions[i-1].options.push(req.body.qn2[k]);
                        form.questions[i-1].options.push(req.body.qn3[k]);
                        form.questions[i-1].options.push(req.body.qn4[k]);
                    }

                    if(form.questions[i-1].options.length !== 0) {
                        form.questions[i-1].options[0] = req.body.qn1[k];
                        form.questions[i-1].options[1] = req.body.qn2[k];
                        form.questions[i-1].options[2] = req.body.qn3[k];
                        form.questions[i-1].options[3] = req.body.qn4[k];
                        k++;
                    }
                }
            }
            await form.questions[i-1].save();
        }


        form.save().then(function(){
             //console.log(form);
             res.redirect('/form/edit/'+ req.params.fid)
        }).catch(function(err){
            console.log(err);
        });

        
    });
});

//create new question
app.post('/form/question/create/:id', urlEncodedParser, isLoggedIn, function(req, res){
    console.log('created question');

    var sess = req.session;
    var currentUser = sess.user;
    //console.log(req.body.question);
    //console.log(req.params.pos);
    Form.findById(req.params.id).exec().then(function(form){
        //console.log(req.body);
        Ques.create({
            question: req.body.question,
            answerType: req.body.answerType,  
            position: form.totalq,
        }).then(function(ques){
            form.questions.push(ques._id);
            form.totalq += 1;
            
            //console.log(ques);
            form.save().then(function(){
                res.redirect('/form/edit/' + req.params.id);
            })
        })
    }).catch(function(err)
    {
        console.log(err);
    });    
    
});

//delete question from form
app.get('/form/edit/:fid/question/delete/:qid', isLoggedIn, function(req, res){
    console.log("deleted question");
    
    var sess = req.session;
    var currentUser = sess.user;

    Form.findById(req.params.fid).exec().then(function(form){
        
        form.questions.pull(req.params.qid);
        form.save().then(function(){
            res.redirect('back');
        })
    }).catch(function(err){
        console.log(err);
    })
});


//=====================================================
//Form response functions
//=====================================================

//Form response to be filled by other user 
app.get('/form/:fid/fill/response', function(req, res, next){
    if(!req.session.user) {
        //console.log(req.params);
        req.session.redirectTo = '/form/' + req.params.fid + '/fill/response';
        req.flash('info', 'Login first to fill the form');
        res.redirect('/login');
    }
    else {
        next();
    }
},
function(req, res){
    console.log('filled form');

    Form.findById(req.params.fid).populate("questions").exec().then(function(form){
        res.render('viewresponse', {form:form});
    }).catch(function(err){
        console.log(err);
    });

});

//To view responses
app.get('/form/:fid/useresponse', function(req, res){

    Form.findById(req.params.fid).populate("questions").exec().then(function(form){

        var opSums = [];
        for(var i = 0; i < form.questions.length; i++) {
            if(form.questions.answerType === "radio") {
                var option = [0, 0, 0, 0];

                option[0] = form.questions.answer.filter(function(x){return x == form.questions.options[0]}).length;
                option[1] = form.questions.answer.filter(function(x){return x == form.questions.options[1]}).length;
                option[2] = form.questions.answer.filter(function(x){return x == form.questions.options[2]}).length;
                option[3] = form.questions.answer.filter(function(x){return x == form.questions.options[3]}).length;

                opSums.push(option);
            }
            else if(form.questions.answerType === "checkbox"){
                var option = [0, 0, 0, 0];

                for(var j = 0; j < form.questions.answer.length; j++) {

                    option[0] = form.questions.answer[j].filter(function(x){return x == form.questions.options[0]}).length;
                    option[1] = form.questions.answer[j].filter(function(x){return x == form.questions.options[1]}).length;
                    option[2] = form.questions.answer[j].filter(function(x){return x == form.questions.options[2]}).length;
                    option[3] = form.questions.answer[j].filter(function(x){return x == form.questions.options[3]}).length;

                    opSums.push(option);
                }
            }

            form.optionCount = opSums;
        }

        form.save().then(function(){
            res.render('useresponses', {form: form});
        })
    });

});



//submit response after filling form
app.post('/form/:fid/submit/response',urlEncodedParser, isLoggedIn,function(req, res){
    console.log('submitted response');

    //console.log(req.body);

    Form.findById(req.params.fid).populate("questions").exec().then(async function(form) {

        if(! form.filledUsers.includes(req.session.user.username)) {
            for(let i = 0; i < form.questions.length; i++) {
                var index = "an" + form.questions[i].position;
                form.questions[i].answer.push(req.body[index]);

                await form.questions[i].save();
            }
            form.filledUsers.push(req.session.user.username);

            form.save().then(function(){
                req.session.user = "";
                req.flash('info', 'Form successfully filled');
                res.redirect('/login');
            });        
        }

        else {
            req.flash('info', 'Error! You can fill the form only once');
            res.redirect('/login');
        }
    });

});


//listen to port
app.listen(3000);
console.log('listening to 3000');
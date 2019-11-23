const express= require('express');
const multer= require('multer');
//const upload = multer({dest:'./uploads'})
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs');
const session= require('express-session');
const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const expressValidator = require('express-validator');
const expressSession = require('express-session');
const flash = require('connect-flash');

const crypto = require('crypto');
const GridFsStorage = require('multer-gridfs-storage');
const Grid  = require('gridfs-stream');
const methodOverride = require('method-override');
const User= require('./models/user')

//..........
var routes = require('./routes/index')
var users= require('./routes/users')
//...........

//Init App
//const app = express()

mongoose.set('useCreateIndex', true)
//const conn = mongoose.connection
mongoose.connect('mongodb://localhost/tienda', { useNewUrlParser: true })
const conn = mongoose.connection

//initialize gfs
let gfs;

//check connection
conn.once('open',() =>{
    console.log('connected to mongodb ')
    //init stream
    ,gfs= Grid(conn.db, mongoose.mongo)
        gfs.collection('uploads')
    
})

//Init App
const app = express()



//Create a storage engine para uploading photos
const storage = new GridFsStorage({
    url: 'mongodb://localhost:27017/tienda',
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });


//check for db errors
conn.on('error', function (err) {
    console.log(err);
})




app.use(passport.initialize());
app.use(passport.session())

//Bring in models
var Article = require('./models/article')


//load view engine
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug','ejs', 'jade')


app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
//app.use(expressValidator)

app.use(methodOverride('_method'))

//to get imformation from forms
app.use(express.urlencoded({extended:false}))

//set public folder for static
app.use(express.static(path.join(__dirname, 'public')))


//express session Middleware
app.use(session({
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true

}))

app.use(passport.initialize())
app.use(passport.session())

//express messages Middleware
app.use(require('connect-flash')());
app.use(function(req, res,next){
    res.locals.messages = require('express-messages')(req, res);
    next()
})

//express validator Middleware
app.use(expressValidator({
  errorFormatter: function(param, msg, value){
     var namespace = param.split('.')
     , root = namespace.shift()
     , formParam = root

   while(namespace.length){
    formParam += '[' + namespace.shift() + ']';
   }
   return{
     param : formParam,
     msg   : msg,
     value : value
   }
  }
}))

//app.use('/',routes);
//app.use('/users', users);


//The home route
app.get('/', function (req, res) {
    res.render('index') 
})



//passing the data from the query to the view
app.get('/article', function (req, res) {
    Article.find({}, function(err, articles){
        if(err){
            console.log(err)
        }else{
            res.render('indek', {
                title: 'Articles',
                articles: articles
        }) 
    }
 })
})

//function ensureAuthenticated(req, res, next) {
var loggedin = function (req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.redirect('/users/login')
    }
}


app.get('/users/register', function (req, res) {
    res.render('register',{title:'Register'})
})

app.post('/users/register', upload.single('profileimage'), function (req, res) {
    var name = req.body.name;
    var email = req.body.email;
    var username = req.body.username;
    var password = req.body.password;
    var password2 = req.body.password2
    //esto es para las imagenes 
    //console.log(req.file)
    if (req.file) {
        console.log('uploading file....');
        var profileimage = req.file.filename;
        console.log(req.file.filename)
    } else {
        console.log('No file uploaded.....el servidor esta ON aun');
        var profileimage = 'noimage.jpg'
    }

    //form validation
    req.checkBody('username','username field is required').notEmpty()
    req.checkBody('email','email field is required').notEmpty()
    req.checkBody('email','email field is not valid').isEmail()
    req.checkBody('name','name field is required').notEmpty()
    req.checkBody('password','password field is required').notEmpty()
    req.checkBody('password2','passwords do not match').equals(req.body.password)

    //Check Errors
    var errors = req.validationErrors();

    if (errors) {
        res.render('register', {
            errors: errors
        })
    } else {
        //var readStream = gfs.createReadStream(profileimage)
        //readStream.pipe(res)
        var newUser = new User({
            username: username,
            email: email,
            name: name,
            password: password,
            profileimage: profileimage
            //profileimage: readstream
            //profileimage: req.file.filename

        })
        User.createUser(newUser, function (err, user) {
            if (err) throw err
            console.log(user)
        })
        //no funciona porque flash (!= message()) in layout.pug
        req.flash('success', 'you are now registered and can login')
        //console.log('you are now registered and can login')

        res.location('/');
        res.redirect('/');
        /*bcrypt.genSalt(10, function(err, salt){
            bcrypt.hash(newUser.password, salt, function(err, hsh){
                if(err){
                    console.log(err)
                }
                newUser.password = hash
                newUser.save(function(err){
                    if(err){
                        console.log(err)
                        return                
                    }else{
                        req.flash('success', 'ya esta registrado, ahora puede login')
                        res.redirect('/users.login')*/

                    //}

                //})
            //})
        //})
        //}
      }//................................................
})


app.get('/users/login', function (req, res) {
    res.render('login',{title:'Login'})
})

app.post('/users/login', 
passport.authenticate('local',{failureRedirect:'/users/login', 
failureFlash:'invalid username or password'}), function (req, res) {
    req.flash('success', 'You are now logged in by hector')
    console.log('You are now logged in by hector')
    res.redirect('/')
})
//add user into a dual session WHY USER.ID.................................
passport.serializeUser(function (user, done) {
    done(null, user.id)
})

//remove user from the session
passport.deserializeUser(function(id, done){
    User.getUserById(id, function(err, user){
        done(err, user)
    })
})
//DONDE IS A VERIFIED CALLBACK
passport.use(new localStrategy(function(username, password,done){
    console.log(username, passport)
    User.getUserByUsername(username, function(err, user){
        if(err) throw err;
        if(!user){
            return done(null, false, {message:'unknown User'})
        }

        User.comparePassword(password, user.password, function(err, isMatch){
            if(err) return done(err)
            if(isMatch){
                return done(null, user);
            }else{
                return done(null, false, {message:'invalid password'})
            }
        });
    })
}))


app.get('/users/forgot_password', function (req, res) {
    res.render('forgot_password')
})

app.post('/users/reset_password', function (req, res) {
    console.log(req.body.email),
    User.findOne({email:req.body.email},function(users){
        console.log('user.name')
    }
    )
})

app.get('/author', loggedin, function (req, res) {
    Article.find({}, function (err, articles) {
        if (err) {
            console.log(err)
        } else {
            res.render('author', {
                author: 'Author of Article ',
                articles: articles
            })
        }
    })
})

app.get('/user', loggedin, function (req, res) {
    User.find({}, function (err, users) {
        if (err) {
            console.log(err)
        } else {
            res.render('indes', {
                title: 'Users',
                users: users
            })
        }
    })
})

//get single user bien sabado
app.get('/user/:id', function (req, res) {
    User.findById(req.params.id, function (err, user) {

        res.render('user', {
            title:'User Information',
            user: user
        })
    })
})



//@route GET
//@Desc Load form
app.get('/photos',loggedin, function (req, res, next) {
    //res.render('imagenes.ejs')
    gfs.files.find().toArray((err, files) => {
        //check if files 
        if (!files || files.length === 0) {
            res.render('imagenes.ejs',{files: false})
            }else{
             files.map(file=>{
               if (file.contentType === 'image/jpeg' || file.contentType === 'image/png')
               {
                 file.isImage = true
               }else{
                 file.IsImage = false
               }
            })
            res.render('imagenes.ejs', { files: files })
        }
    })
})


//Upload photo to DB
/app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ file: req.file })
    //res.redirect('/photos');
    console.log('photo uploaded by hector')


})


//Display all files in json
app.get('/files', (req, res)=>{
    gfs.files.find().toArray((err, files)=>{
    //gfs.files.find(),(err, files) => {   
        //check if files
        if(!files || files.length === 0){
            return res.status(404).json({
                err: "no files exist"
            })
        }
        
        //file exist
        return res.json(files)
        //res.redirect('showPhoto') puesto por mi
    })
})

//get/file/:filename
app.get('/files/:filename', (req, res) => {
    gfs.files.findOne({filename: req.params.filename},(err, file)=>{
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: "no file exists"
            })
        }
        //file exist
        return res.json(file)
        //res.render(file)
    })
    
})

//get/imagenes/image

app.get('/image/:filename', (req, res) => {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: "no file exists"
            })
        }
        //check if image
        if (file.contentType === 'image/jpeg' || file.contentType === 'image/png'){
            const readStream = gfs.createReadStream(file.filename)
            readStream.pipe(res)

        }else{
            res.status(404).json({
                err:"Not an image"
            })
        }
    })
})
    





app.get('/articles/add', loggedin, function(req, res){
    res.render('add_article', {
        title: 'Add Article'
    })

})

//get single article bien sabado
app.get('/article/:id', function (req, res) {
    Article.findById(req.params.id, function (err, article) {
        //console.log(article)
        //return;
        res.render('article', {
            article: article
        })
    })
})



app.post('/articles/add', function (req, res, next) {
    /*req.checkBody('Title', 'title is required'),notEmpty(),
    req.checkBody('Aithor', 'author is required'), notEmpty(),
    req.checkBody('Body', 'body is required'), notEmpty()*/
    

    var article = new Article();
    article.title = req.body.title
    article.author = req.body.author
    article.body = req.body.body



    article.save(function (err) {
        if (err) {
            console.log(err);
            return;
        } else {
            req.flash('success', 'Article added')
            console.log('Article added')
            res.redirect('/');
        }
    })
})


/*app.get('/user/edit/:id', function(req, res){
    User.findById(req.params.id, function (err, user) {
        res.render('edit_user')
    })

})*/


//load edit form
app.get('/article/edit/:id', function (req, res) {
    Article.findById(req.params.id, function (err, article) {
        //console.log(article)
        //return;
        res.render('edit_article', {
            title: 'Edit Article',
            article: article
        })
    })
})


//load edit form
app.get('/users/edit/:id', function (req, res) {
    User.findById(req.params.id, function (err, user) {
        //console.log(article)
        //return;
        res.render('edit_user', {
            title: 'Edit User',
            user:user
        })
    })
})


//update Submit ----------------------------------------------------------
app.post('/articles/edit/:id', function (req, res) {


    var article = {};
    article.title = req.body.title
    article.author = req.body.author
    article.body = req.body.body

    var query = { _id: req.params.id }

    Article.updateOne(query, article, function (err) {
        if (err) {
            console.log(err);
            return;
        } else {
            //req.flash('success', 'Article updated')
            res.redirect('/');
        }
    })
})
//update Submit ----------------------------------------------------------
app.post('/user/edit/:id', function (req, res) {
    req.flash('success', 'you do not have sufficente priviliges to delete or upadate users')

    /*var user = {};
    user.name = req.body.name
    user.username = req.body.username
    user.email = req.body.email
    user.file.profileimage = req.body.profileimage

    var query = { _id: req.params.id }

    User.updateOne(query, user, function (err) {
        if (err) {
            console.log(err);
            return;
        } else {
            //req.flash('success', 'Article updated')
            res.redirect('/');
        }
    })*/
})


app.delete('/article/:id', function(req, res){
    var query = { _id: req.params.id }

    Article.deleteOne(query, function(err){
        if(err){
            console.log(err)
        }
        res.send('success')
    })
})

app.get('/users/logout', function (req, res) {
    req.logout();
    req.flash('success', 'you are now log out')
    res.redirect('/users/login')
})


//start server
app.listen(3000, function(){
    console.log("server started on port 3000")
})

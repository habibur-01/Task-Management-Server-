const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 3000

// middleware
app.use(cors({
    origin: [
        'http://localhost:5173'
    ],
    credentials: true,
}))
app.use(express.json())



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.cbqlcas.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // Create Database
        const taskCollection = client.db('taskmangament').collection('task')
        const userCollection = client.db('taskmangament').collection('users')

        // jwt api
        app.post('/jwt', async(req, res)=>{
            const user = req.body
            const token = jwt.sign(user, process.env.Access_Token,{
                expiresIn: '1h'
            })
            res.send({token})
        })

        // verified middleware
        const verifyToken = (req, res, next)=>{
            // console.log('inside verify token', req.headers)
            if(!req.headers.authorization){
                return res.status(401).send({message: 'unauthorized access'})
            }
            const token= req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.Access_Token, (err, decoded)=>{
                if(err){
                    return res.status(401).send({message: 'unauthorized access'})
                }
                req.decoded = decoded
                next()
            })
            

        }

        // verify admin
        const verifyAdmin = async(req, res, next) => {
            const email = req.decoded.email;
            const query = {email: email}
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if(!isAdmin){
                return res.status(403).send({message: 'forbidden access'})
            }
            next()
        }

        app.get('/users/admin/:email', verifyToken, async (req, res)=>{
            const email = req.params.email;
            if(email !== req.decoded.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const query = {email: email};
            const user = await userCollection.findOne(query);
            let admin = false;
            if(user.role === 'admin'){
                admin= true;
            }
            
            res.send({admin});
        })


        // user post
        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user?.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })
        app.get('/users', verifyToken, verifyAdmin, async(req, res)=>{
            const result = await userCollection.find().toArray()
            res.send(result)
        })
        // get user
        app.get('/profile',   async (req, res) => {
            // console.log(req.headers)
            const email = req.query.email
            let query={}
            if(req.query?.email){
                query={email: email}
            }
            const result = await userCollection.find(query).toArray()
            res.send(result)
        })
        app.delete('/users/:id',verifyToken, verifyAdmin, async(req,res)=>{
             const id = req.params.id
             const query = {_id: new ObjectId(id)}
             const result = await userCollection.deleteOne(query)
             res.send(result)
        })
        app.patch('/users/:id', verifyToken, verifyAdmin, async(req,res)=>{
             const id = req.params.id
             const query = {_id: new ObjectId(id)}
             const updateDoc={
                $set:{
                    role: 'admin'
                }
             }
             const result = await userCollection.updateOne(query, updateDoc)
             res.send(result)
        })
        // count user data
        app.get('/users/count', verifyToken, verifyAdmin, async (req, res) => {
            
            
            const queryuser = {
                role: 'user'
            }
            const queryadmin = {
                role: 'admin'
            };
            

            // Count the number of documents that match the query
            const alluser = await userCollection.countDocuments()
            const user = await userCollection.countDocuments(queryuser);
            const admincount = await userCollection.countDocuments(queryadmin);
            

            res.send({ 
                totaluser:alluser,
                onlyuser: user,
                admin:admincount,
                
             });
        
    });


        // post task into database
        app.post('/task', verifyToken, async (req, res) => {
            const task = req.body
            const result = await taskCollection.insertOne(task)
            res.send(result)
        })
        app.get('/task', async (req, res) => {

            const result = await taskCollection.find().toArray();
            res.send(result);

        });
        app.get('/task/complete', verifyToken, async (req, res) => {
            const email = req.query.email
            const status = req.query.status

            let query = {}
            if (email && status) {
                query = {
                    $and: [
                        { email: email },
                        { status: status }
                    ]
                };
            }
            const result = await taskCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/task/paginate', verifyToken, async (req, res) => {
            let query = {}
            const email = req.query.email
            const currentPage = parseInt(req.query.page) || 0;
            const itemsPerPage = 6

            if (req.query?.email) {
                query = { email: email }
            }
            const totalTask = await taskCollection.countDocuments(query)
            const totalPages = Math.ceil(totalTask / itemsPerPage)
            // const startIndex = currentPage * itemsPerPage
            // const endIndex = startIndex + itemsPerPage
            const result = await taskCollection.find(query)
                .skip((currentPage) * itemsPerPage)
                .limit(itemsPerPage).toArray()
            res.send({
                tasks: result,
                currentPage: currentPage,
                totalPages: totalPages
            })
        })

        app.delete('/task/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await taskCollection.deleteOne(query)
            res.send(result)
        })

        app.patch('/task/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const task = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    projectName: task.projectName,
                    priority: task.priority,
                    startDate: task.startDate,
                    endDate: task.endDate,
                    description: task.description
                }
            }
            const result = await taskCollection.updateOne(query, updateDoc)
            res.send(result)

        })

        // update status
        app.patch('/task/status/:id', verifyToken, async (req, res) => {
            const id = req.params.id
            const data = req.body
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await taskCollection.updateOne(query, updateDoc)
            res.send(result)

        })

       // count task document
        app.get('/task/count', verifyToken, async (req, res) => {
            
                const email = req.query.email;

                if (!email) {
                    res.status(400).send('Email parameter is required');
                    return;
                }

                // Construct the MongoDB query to count tasks with 'progress' status for the specified email
                const queryTask = {
                    email: email
                }
                const queryProgressData = {
                    email: email,
                    status: 'progress'
                };
                const queryCompleteTask = {
                    email: email,
                    status: 'completed'
                };
                const queryTodoTask = {
                    email: email,
                    status: 'pending'
                };
                

                // Count the number of documents that match the query
                const alltask = await taskCollection.countDocuments(queryTask)
                const progress = await taskCollection.countDocuments(queryProgressData);
                const completed = await taskCollection.countDocuments(queryCompleteTask);
                const todo = await taskCollection.countDocuments(queryTodoTask);

                res.send({ 
                    totalTask:alltask,
                    progressTask: progress,
                    completedTask:completed,
                    pendingTask:todo
                 });
            
        });


        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
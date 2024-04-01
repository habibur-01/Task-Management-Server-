const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express()
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
        // get user
        app.get('/users', async (req, res) => {
            const result = await userCollection.find().toArray()
            res.send(result)
        })
        // post task into database
        app.post('/task', async (req, res) => {
            const task = req.body
            const result = await taskCollection.insertOne(task)
            res.send(result)
        })

        app.get('/task', async (req, res) => {
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

        app.delete('/task/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await taskCollection.deleteOne(query)
            res.send(result)
        })

        app.patch('/task/:id', async (req, res) => {
            const id = req.params.id
            const task = req.body
            const query={_id:new ObjectId(id)}
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
const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

// ...middleWare...
app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Welcome to phone garage!')
})

// ....mongodb connection..

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xazyemr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const categoriesCollection = client.db("phoneGarage").collection("categories")

        // ...categories..
        app.get('/categories', async (req, res) => {
            const query = {}
            const allCategories = await categoriesCollection.find(query).toArray()
            res.send(allCategories)
        })
    }
    finally {

    }
}
run().catch(console.log)



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
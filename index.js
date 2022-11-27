const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

// ...middleWare...
app.use(cors());
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Welcome to phone garage!')
})

// ...jwt middleware...
function verifyJWT(req, res, next) {
    const authHeader = req?.headers?.authorization
    if (!authHeader) {
        return res.send({ message: "unauthorized access" })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.send({ message: "Access forbidden" })
        }
        req.decoded = decoded
        next()
    })
}

// ....mongodb connection..
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xazyemr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const categoriesCollection = client.db("phoneGarage").collection("categories")
        const productsCollection = client.db("phoneGarage").collection("productCollection")
        const usersCollection = client.db("phoneGarage").collection("users")
        const bookingsCollection = client.db("phoneGarage").collection("bookings")
        const paymentsCollection = client.db("phoneGarage").collection("payments")

        // ...verify seller and use it after verify JWT...
        const verifySeller = async (req, res, next) => {
            const decodedEmail = req?.decoded?.email
            const query = {
                email: decodedEmail
            }
            const currentUser = await usersCollection.findOne(query)
            if (currentUser?.accountStatus !== "Seller Account") {
                return res.status(403).send({ message: "Forbidden access" })
            }
            next()
        }
        // ...verify admin and use it after verify JWT...
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req?.decoded?.email
            const query = {
                email: decodedEmail
            }
            const currentUser = await usersCollection.findOne(query)
            if (currentUser?.accountStatus !== "Admin") {
                return res.status(403).send({ message: "Forbidden access" })
            }
            next()
        }
        // ...categories..
        app.get('/categories', async (req, res) => {
            const query = {}
            const allCategories = await categoriesCollection.find(query).toArray()
            res.send(allCategories)
        })
        // ...productCollection..
        app.get('/products/:category', async (req, res) => {
            const getCategory = req.params.category
            const query = {
                category: getCategory,
                paid: false
            }
            const productsByCatg = await productsCollection.find(query).toArray()
            res.send(productsByCatg)
        })
        app.post('/products/add', verifyJWT, verifySeller, async (req, res) => {
            const productInfo = req.body
            const result = await productsCollection.insertOne(productInfo);
            res.send(result)
        })
        app.get('/sellerProducts', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.email
            const query = {
                email: email
            }
            const result = await productsCollection.find(query).toArray()
            res.send(result)
        })

        // ...advertise..
        app.put('/advertise', verifyJWT, verifySeller, async (req, res) => {
            const id = req.query.id
            console.log(id)
            const filter = {
                _id: ObjectId(id)
            }
            // const productById = await productsCollection.findOne(query)
            const productUpdatedDoc = {
                $set: {
                    isAdvertise: true
                }
            }
            const result = await productsCollection.updateOne(filter, productUpdatedDoc)
            res.send(result)
        })
        // show advertise productsCollection.
        app.get('/advertiseProducts', async (req, res) => {
            const query = {
                isAdvertise: true,
                paid: false
            }
            const result = await productsCollection.find(query).toArray()
            res.send(result)
        })
        // ..delete products
        app.delete('/products/delete/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const query = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(query)
            res.send(result)
        })
        // ..jwt set up when user register or login..
        app.get('/jwt', async (req, res) => {
            const email = req.query.email
            const query = {
                email: email
            }
            const user = await usersCollection.findOne(query)
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: "24hr" })
                return res.send({ accessToken: token })
            }
            res.send({ accessToken: " " })

        })
        // ..all users collection..

        app.post('/users', async (req, res) => {
            const user = req.body
            const userCollection = await usersCollection.insertOne(user)
            res.send(userCollection)
        })

        // ...users loginPopup check
        app.post('/users/popup', async (req, res) => {
            const user = req.body
            // console.log(user)
            const query = { email: user.email }
            const alreadyAddeduser = await usersCollection.findOne(query)
            if (!alreadyAddeduser) {
                const userCollection = await usersCollection.insertOne(user)
                return res.send(userCollection)
            }
            if (alreadyAddeduser) {
                return res.send(alreadyAddeduser)
            }

        })

        //...... bookingsCollection
        app.post('/bookings', async (req, res) => {
            const bookingInfo = req.body
            // console.log(bookingInfo)
            const query = {
                customerEmail: bookingInfo.customerEmail,
                productId: bookingInfo.productId
            }
            // console.log(query)
            const alreadyBooked = await bookingsCollection.find(query).toArray()
            if (alreadyBooked.length) {
                const message = `You have already booked this ${bookingInfo.ProductName}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingsCollection.insertOne(bookingInfo)
            res.send(result)
        })

        //booking collection by email
        app.get('/bookings', verifyJWT, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.send({ message: "Access forbidden" })
            }
            const query = {
                customerEmail: email
            }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)

        })
        //bookingCollection by id 
        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const query = { _id: ObjectId(id) }
            const result = await bookingsCollection.findOne(query)
            res.send(result)
        })

        // ...payment..

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body
            const price = parseInt(booking.resalePrice)

            const amount = price * 100
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })
        app.post('/payments', async (req, res) => {
            const payment = req.body
            const result = await paymentsCollection.insertOne(payment)
            const id = payment.bookingId
            const filter = {
                _id: ObjectId(id)
            }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingsCollection.updateOne(filter, updatedDoc)
            const productId = payment.productId
            const productFilter = {
                _id: ObjectId(productId)
            }
            const productUpdatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const productUpdatedResult = await productsCollection.updateOne(productFilter, productUpdatedDoc)
            res.send(result);
        })
        // ...seller option...
        app.get('/users/seller', async (req, res) => {
            const email = req.query.email;
            const query = {
                email: email
            }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user.accountStatus === "Seller Account" })
        })

        // ..admin option..
        app.get('/users/admin', async (req, res) => {
            const email = req.query.email;
            const query = {
                email: email
            }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user.accountStatus === "Admin" })
        })
        // ..allSellerCollection...
        app.get('/allSellers', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {
                accountStatus: "Seller Account"
            }
            const result = await usersCollection.find(query).toArray()
            res.send(result)
        })
        // ..verifySeller..
        app.put('/verifySeller', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.query.email
            const query = {
                email: email
            }
            // const productsByEmail = await productsCollection.find(query).toArray()
            const updatedDoc = {
                $set: {
                    verifiedStatus: "verified",
                }
            }
            const updateProductsByEmail = await productsCollection.updateMany(query, updatedDoc);

            const updateSeller = await usersCollection.updateOne(query, updatedDoc);
            res.send({ updateProductsByEmail, updateSeller })
        })
    }
    finally {

    }
}
run().catch(console.log)



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
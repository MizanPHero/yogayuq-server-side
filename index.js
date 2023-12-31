const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const cors = require('cors');
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());



const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}





const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
//MAIN
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xudqfrq.mongodb.net/?retryWrites=true&w=majority`;
//BACKUP
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.y7oa7qi.mongodb.net/?retryWrites=true&w=majority`;

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

    const usersCollection = client.db("yogaDB").collection("users");
    const classesCollection = client.db("yogaDB").collection("classes");
    const cartsCollection = client.db("yogaDB").collection("carts");
    const paymentsCollection = client.db("yogaDB").collection("payments");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' });
      res.send({ token })
    })

    //user related apis
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    app.get('/users/instructors', async (req, res) => {
      const query = {role: 'instructor'};

      const cursor = usersCollection.find(query);
      const result = await cursor.toArray();
      return res.send(result);
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })


    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })



    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
    
      if (req.decoded.email !== email) {
        return res.send({ instructor: false });
      }
    
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' };
      res.send(result);
    });
    

    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })



    //class related apis
    app.get('/classes', verifyJWT, async (req, res) => {
      const email = req.query.email;
    
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
    
      const query = { instructorEmail: email };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });
    
    app.get('/allclasses', async (req, res) => {
      const result = await classesCollection.find({}).toArray();
      res.send(result);
    });

    app.get('/class/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classesCollection.findOne(query);
      res.send(result);
    })

    app.get('/classfeedback/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classesCollection.findOne(query);
      res.send(result);
    })

    app.get('/popularclasses', async (req, res) => {
      const query = { enrolled: { $gte: 0 } };
      const options = {
        sort: { enrolled: -1 }
      };

      const cursor = classesCollection.find(query, options);
      const result = await cursor.toArray();
      return res.send(result);
    })

    app.post('/classes', async (req, res) => {
      const body = req.body;
      const result = await classesCollection.insertOne(body)
      res.send(result)
    })

    app.patch('/class/approve/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.put('/classfeedback/:id', async (req, res) => {
      const body = req.body;
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          feedback: body.feedback
        }
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    })


    app.patch('/class/deny/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'denied'
        },
      };

      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    })



    // cart apis

    app.post('/carts', async (req, res) => {
      const body = req.body;
      const result = await cartsCollection.insertOne(body)
      res.send(result)
    })

    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
    
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }


      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });


    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })


    // create payment intent
    app.post("/create-payment", verifyJWT, async (req, res)=>{
      const {price} = req.body;
      console.log(price);
      const cents = parseFloat(price * 100);
      const intent = await stripe.paymentIntents.create({
        amount: cents,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.send({clientSecret: intent?.client_secret})
    })



    // payments api 
    app.post('/payments', verifyJWT, async (req, res) => {
      const body = req.body;
      const result = await paymentsCollection.insertOne({...body, date: new Date()});
      const {enrolled, seat} = await classesCollection.findOne({_id: new ObjectId(body.classId)});
      await classesCollection.updateOne({_id: new ObjectId(body.classId)}, {$set: {enrolled: enrolled + 1, seat: seat - 1}});
      await cartsCollection.deleteOne({_id: new ObjectId(body.cardId)});
      res.send(result);
    })


    app.get('/payments', verifyJWT, async (req, res) => {
      const email = req.query.email;
    
      if (!email) {
        res.send([]);
      }
    
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' });
      }
    
      const query = { email: email };
      const result = await paymentsCollection.find(query).sort({ date: -1 }).toArray();
      res.send(result);
    });
    





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server is running')
})

app.listen(port, () => {
  console.log(`server is running on port ${port}`);
})
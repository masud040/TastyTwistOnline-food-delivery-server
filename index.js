const express = require("express");
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.stripe_secret_key);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xlqw0ck.mongodb.net/?retryWrites=true&w=majority`;

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cors());
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    // db collections
    const restaurantCollections = client
      .db("tastyTwistOnline")
      .collection("restaurants");
    const menuCollections = client
      .db("tastyTwistOnline")
      .collection("foodMenu");
    const reviewCollections = client
      .db("tastyTwistOnline")
      .collection("reviews");
    const faqCollections = client.db("tastyTwistOnline").collection("faqs");
    const userCollections = client.db("tastyTwistOnline").collection("users");
    const cartCollections = client.db("tastyTwistOnline").collection("carts");
    const favoriteCollections = client
      .db("tastyTwistOnline")
      .collection("favorites");
    const addressCollections = client
      .db("tastyTwistOnline")
      .collection("users-address");
    const orderCollections = client.db("tastyTwistOnline").collection("orders");

    // check user role
    app.get("/users/:email", async (req, res) => {
      const query = { email: req.params?.email };
      const user = await userCollections.findOne(query);
      const result = { role: user?.role };
      res.send(result);
    });

    // save user $ modify user role
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const isExist = await userCollections.findOne(query);
      console.log("User found?----->", isExist);

      if (isExist) {
        if (user?.status === "Requested") {
          const result = await userCollections.updateOne(
            query,
            {
              $set: { status: user.status },
            },
            options
          );
          return res.send(result);
        } else {
          return res.send(isExist);
        }
      }
      const result = await userCollections.updateOne(
        query,
        {
          $set: { ...user, timeStamp: Date.now() },
        },
        options
      );
      res.send(result);
    });

    // restaurants
    app.get("/restaurants", async (req, res) => {
      const restaurantEmail = req.query.email;
      const query = { email: restaurantEmail };
      if (restaurantEmail) {
        const result = await restaurantCollections.findOne(query);
        return res.send(result);
      }
      const result = await restaurantCollections.find().toArray();
      res.send(result);
    });

    // get all menu items
    app.get("/menu/:email", async (req, res) => {
      const category = req.query?.category;

      let query = { email: req.params.email };
      if (category && category !== "popular") {
        query.category = category;
      }

      const result = await menuCollections.find(query).toArray();
      res.send(result);
    });

    // add menu
    app.post("/menu", async (req, res) => {
      const menu = req.body;
      const result = await menuCollections.insertOne(menu);
      res.send(result);
    });

    // edit menu item
    app.patch("/menu/edit/:id", async (req, res) => {
      const menu = req.body;
      const query = { _id: new ObjectId(req.params?.id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...menu,
        },
      };
      const result = await menuCollections.updateOne(query, updateDoc, options);
      res.send(result);
    });

    //delete menu item
    app.delete("/menu/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params?.id) };
      const result = await menuCollections.deleteOne(query);
      res.send(result);
    });

    // cart related
    app.get("/select-carts/:ids", async (req, res) => {
      const ids = req.params.ids;
      const idArray = ids?.split(",");
      const query = { _id: { $in: idArray.map((id) => new ObjectId(id)) } };
      const result = await cartCollections.find(query).toArray();
      res.send(result);
    });
    app.post("/carts", async (req, res) => {
      const orderData = req.body;
      const place = req.query.place;
      if (place === "cart") {
        const result = await cartCollections.insertOne(orderData);
        res.send(result);
      } else {
        const result = await favoriteCollections.insertOne(orderData);
        res.send(result);
      }
    });

    // get cartItems
    app.get("/carts/:email", async (req, res) => {
      const email = req.params.email;
      const result = await cartCollections.find({ email: email }).toArray();
      res.send(result);
    });
    // update cart count
    app.patch("/carts/:id", async (req, res) => {
      const data = req.body;
      const query = { _id: new ObjectId(req.params.id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          count: data.itemCount,
        },
      };
      const result = await cartCollections.updateOne(query, updateDoc, options);
      res.send(result);
    });
    // get order item
    app.get("/orders/:email", async (req, res) => {
      const query = { email: req.params.email };
      const options = {
        projection: {
          _id: 1,
          transactionId: 1,
          total: 1,
          orderId: 1,
          status: 1,
          menuId: 1,
          date: 1,
          estimatedDate: 1,
          "cartItems.count": 1,
          "cartItems.image": 1,
          "cartItems.name": 1,
          "cartItems.price": 1,
        },
      };
      const result = await orderCollections.find(query, options).toArray();
      res.send(result);
    });
    // set order
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const cartItemsId = order.cartId;
      const query = { _id: { $in: cartItemsId.map((id) => new ObjectId(id)) } };
      await cartCollections.deleteMany(query);
      const result = await orderCollections.insertOne(order);
      res.send(result);
    });
    // address
    app.get("/address/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await addressCollections.findOne(query);
      res.send(result);
    });

    app.post("/address", async (req, res) => {
      const address = req.body;
      const result = await addressCollections.insertOne(address);
      res.send(result);
    });
    app.put("/address/:email", async (req, res) => {
      const query = { email: req.params.email };
      const address = req.body;
      const result = await addressCollections.replaceOne(query, address);
      res.send(result);
    });
    // update user email
    app.patch("/email/:email", async (req, res) => {
      const newEmail = req.query.email;
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          newEmail,
        },
      };
      const result = await addressCollections.updateOne(
        {
          email: req.params.email,
        },
        updateDoc,
        options
      );

      res.send(result);
    });
    // get all review
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollections.find().toArray();
      res.send(result);
    });

    // get faq
    app.get("/faqs", async (req, res) => {
      const result = await faqCollections.find().toArray();
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Food Delivery server in running");
});

app.listen(port, () => {
  console.log(`Food delivery listening on port ${port}`);
});

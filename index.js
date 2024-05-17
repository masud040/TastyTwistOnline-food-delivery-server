const express = require("express");
const { Resend } = require("resend");
const cors = require("cors");
var cookieParser = require("cookie-parser");
require("dotenv").config();
const stripe = require("stripe")(process.env.stripe_secret_key);
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xlqw0ck.mongodb.net/?retryWrites=true&w=majority`;
const app = express();
const resend = new Resend(process.env.RESEND_API);
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://6647a20f8c65b10dda4cdbba--profound-torte-5af664.netlify.app",
    ],
    credentials: true,
  })
);
app.use(cookieParser());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// db collections
const restaurantCollections = client
  .db("tastyTwistOnline")
  .collection("restaurants");
const menuCollections = client.db("tastyTwistOnline").collection("foodMenu");
const reviewCollections = client.db("tastyTwistOnline").collection("reviews");
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
const couponsCollections = client.db("tastyTwistOnline").collection("coupons");
const requestRestaurantCollections = client
  .db("tastyTwistOnline")
  .collection("requestedRestaurants");

const feebackCollections = client
  .db("tastyTwistOnline")
  .collection("foodReviews");

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decode) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.user = decoded;

    next();
  });
};
async function run() {
  try {
    // await client.connect();

    // JWT related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1hr",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          sameSite: "none",
          secure: true,
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      await res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // check user role
    app.get("/users/:email", async (req, res) => {
      const query = { email: req.params?.email };
      const user = await userCollections.findOne(query);
      const result = {
        role: user?.role,
        status: user?.status,
        timeStamp: user?.timeStamp,
      };
      res.send(result);
    });

    // save user $ modify user role
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
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
      const restaurantEmail = req.query?.email;
      const query = { email: restaurantEmail };

      if (restaurantEmail) {
        const result = await restaurantCollections.findOne(query);
        return res.send(result);
      }
      const result = await restaurantCollections.find().toArray();
      res.send(result);
    });

    // add restaurant
    app.post("/requested/restaurants", async (req, res) => {
      const restaurantData = req.body;
      const query = { email: req.query?.email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: "Pending",
        },
      };
      const result = await requestRestaurantCollections.insertOne(
        restaurantData
      );
      const result1 = await userCollections.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(result);
    });

    //update restaurant
    app.patch("/restaurants/:id", async (req, res) => {
      const restaurantData = req.body;
      const filter = { _id: new ObjectId(req.params?.id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          ...restaurantData,
        },
      };
      const result = await restaurantCollections.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // get all menu items
    app.get("/menu/:email", async (req, res) => {
      const category = req.query?.category;
      const order = req.query?.order;
      const minPrice = parseFloat(req.query?.minPrice);
      const maxPrice = parseFloat(req.query?.maxPrice);

      let query = { email: req.params.email };
      if (category && category !== "popular") {
        query.category = category;
      }
      if (minPrice && maxPrice) {
        let priceRange = { $lt: maxPrice, $gt: minPrice };
        query.price = priceRange;
      }

      const result = await menuCollections
        .find(query)
        .sort({ price: order === "asc" ? 1 : -1 })
        .toArray();
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
    // post conditionally in cart and favorites
    app.post("/carts-favorite", async (req, res) => {
      const orderData = req.body;
      const items = req.query?.items;
      if (items === "carts") {
        const matches = await cartCollections.findOne({
          $and: [{ email: orderData.email }, { menuId: orderData.menuId }],
        });
        if (matches) {
          res.send({
            message: "You have already added this item. please update quantity",
          });
        } else {
          const result = await cartCollections.insertOne(orderData);
          res.send(result);
        }
      } else {
        const result = await favoriteCollections.insertOne(orderData);
        res.send(result);
      }
    });

    // get cartItems
    app.get("/carts-favorite/:email", async (req, res) => {
      const items = req.query?.items;
      const email = req.params.email;
      if (items === "carts") {
        const result = await cartCollections.find({ email: email }).toArray();
        res.send(result);
      } else {
        const result = await favoriteCollections
          .find({ email: email })
          .toArray();
        res.send(result);
      }
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

    app.post("/move-carts-favorite/:id", async (req, res) => {
      const item = req.query?.item;
      const query = { _id: new ObjectId(req.params.id) };
      const order = req.body;
      if (item === "favorite") {
        const deleteResult = await favoriteCollections.deleteOne(query);
        const result = await cartCollections.insertOne(order);
        res.send(result);
      } else {
        const deleteResult = await cartCollections.deleteOne(query);
        const result = await favoriteCollections.insertOne(order);
        res.send(result);
      }
    });

    // delete cart and favorites items
    app.delete("/carts-favorite/:id", async (req, res) => {
      const items = req.query?.items;
      const query = { _id: new ObjectId(req.params.id) };
      if (items === "favorite") {
        const result = await favoriteCollections.deleteOne(query);
        res.send(result);
      } else {
        const result = await cartCollections.deleteOne(query);
        res.send(result);
      }
    });
    // get order item
    app.get("/orders/:email", async (req, res) => {
      const person = req.query.person;
      let query = {};
      if (person === "seller") {
        query.sellerEmail = req.params.email;
      } else {
        query.email = req.params.email;
      }

      const options = {
        projection: {
          _id: 1,
          email: 1,
          transactionId: 1,
          total: 1,
          orderId: 1,
          status: 1,
          isFeedback: 1,
          menuId: 1,
          date: 1,
          estimatedDate: 1,
          "cartItems.count": 1,
          "cartItems._id": 1,
          "cartItems.image": 1,
          "cartItems.name": 1,
          "cartItems.price": 1,
          "cartItems.menuId": 1,
          "cartItems.sellerEmail": 1,
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

    // handle order
    app.patch("/orders/:id", async (req, res) => {
      const query = { _id: new ObjectId(req.params.id) };
      const currrentStatus = req.query.status;
      const options = { upsert: true };
      let status = "";
      if (currrentStatus === "processing") {
        status = "shipped";
      }
      if (currrentStatus === "shipped") {
        status = "delivered";
      }
      if (currrentStatus === "cancelled") {
        status = "cancelled";
      }
      const updateDoc = {
        $set: {
          status,
        },
      };
      const result = await orderCollections.updateOne(
        query,
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

    // handle coupon
    app.get("/coupons", async (req, res) => {
      const result = await couponsCollections.findOne();
      res.send(result);
    });

    //edit coupon
    app.patch("/coupons/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params?.id) };
      const coupon = req.body;
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          ...coupon,
        },
      };
      const result = await couponsCollections.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.post("/coupons", async (req, res) => {
      const coupon = req.body;
      const result = await couponsCollections.insertOne(coupon);
      res.send(result);
    });

    // handle user
    app.get("/seller-request", async (req, res) => {
      const query = { status: { $in: ["Requested", "Pending"] } };
      const result = await userCollections.find(query).toArray();
      res.send(result);
    });
    // handle change status
    app.patch("/user/status/:email", async (req, res) => {
      const changeToStatus = req.query?.status;
      const query = { email: req.params.email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: changeToStatus,
        },
      };
      const result = await userCollections.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // get request restaurant

    app.get("/requested/restaurants/:email", async (req, res) => {
      const result = await requestRestaurantCollections.findOne({
        email: req.params?.email,
      });
      res.send(result);
    });

    app.post("/restaurants/:email", async (req, res) => {
      const restaurant = req.body;
      await userCollections.updateOne(
        { email: req.params?.email },
        { $unset: { status: 1 }, $set: { role: "seller" } }
      );
      const result = await restaurantCollections.insertOne(restaurant);
      await requestRestaurantCollections.deleteOne({
        email: req.params?.email,
      });
      res.send(result);
    });

    app.delete("/restaurants/:email", async (req, res) => {
      const result = await requestRestaurantCollections.deleteOne({
        email: req.params?.email,
      });
      await userCollections.updateOne(
        { email: req.params?.email },
        { $set: { status: "Canceled" } }
      );
      res.send(result);
    });

    //get feedback
    app.get("/feedbacks", async (req, res) => {
      try {
        const page = parseInt(req.query?.page);
        const size = parseInt(req.query?.size);
        let query;
        if (req.query?.email) {
          query = { sellerEmail: req.query?.email };
        } else if (req.query?.id) {
          query = { menuId: req.query?.id };
        } else {
          const result = await feebackCollections
            .find()
            .skip(page * size)
            .limit(size)
            .toArray();
          res.send(result);
          return;
        }

        const result = await feebackCollections.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error);
      }
    });

    // add feedback
    app.post("/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.body;
      const options = { upsert: true };
      const result = await feebackCollections.insertOne(feedback);
      await orderCollections.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isFeedback: true } }
      );
      res.send(result);
    });

    // delete feedback
    app.delete("/delete-feedback/:id", async (req, res) => {
      const result = await feebackCollections.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
    app.delete("/orders/:id", async (req, res) => {
      const feedback = {
        userName: req.query?.name,
        reason: req.query?.reason,
        photo: req.query?.image,
        cancelMenuId: req.query?.menuId,
        sellerEmail: req.query?.sellerEmail,
        cancel: true,
      };

      const result = await feebackCollections.insertOne(feedback);
      await orderCollections.deleteOne({
        _id: new ObjectId(req.params?.id),
      });

      res.send(result);
    });

    app.get("/seller/stats/:email", async (req, res) => {
      const totalOrder = await orderCollections.countDocuments({
        $and: [{ sellerEmail: req.params.email }, { status: "delivered" }],
      });
      const cancelOrder = await orderCollections.countDocuments({
        $and: [{ sellerEmail: req.params.email }, { status: "cancelled" }],
      });
      const totalItem = await menuCollections.countDocuments({
        email: req.params.email,
      });
      const totalFeedback = await feebackCollections.countDocuments({
        sellerEmail: req.params.email,
      });
      const totalUser = await userCollections.estimatedDocumentCount();

      const result = await orderCollections
        .aggregate([
          {
            $match: {
              sellerEmail: req.params?.email,
              status: "delivered",
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$total",
              },
            },
          },
        ])
        .toArray();
      const totalRevenue = result?.length > 0 ? result[0].totalRevenue : 0;
      res.send({
        totalRevenue,
        totalOrder,
        cancelOrder,
        totalItem,
        totalFeedback,
        totalUser,
      });
    });

    //using aggregate pipeline
    app.get("/order-stats/:email", async (req, res) => {
      const sellerEmail = req.params?.email;
      try {
        const result = await orderCollections
          .aggregate([
            {
              $match: {
                sellerEmail,
                status: "delivered",
              },
            },
            {
              $unwind: "$menuId",
            },
            {
              $lookup: {
                from: "foodMenu",
                let: { menuId: "$menuId" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: [{ $toString: "$_id" }, "$$menuId"],
                      },
                    },
                  },
                ],
                as: "menuItems",
              },
            },
            {
              $unwind: "$menuItems",
            },
            {
              $group: {
                _id: "$menuItems.category",
                quantity: {
                  $sum: 1,
                },
                revenue: { $sum: "$menuItems.price" },
              },
            },
            {
              $project: {
                _id: 0,
                category: "$_id",
                quantity: "$quantity",
                revenue: "$revenue",
              },
            },
          ])
          .toArray();
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    //send email after order
    app.post("/send-mail", async (req, res) => {
      const { data, error } = await resend.emails.send({
        from: "TastyTwist Online Food <onboarding@resend.dev>",
        to: req.body?.user?.email,
        subject: "Order Confirmation",
        text: "Your order has been confirmed",
        html: `<div>
        <p>Dear ${req?.body?.user?.displayName}</p>
        <p>Thank you for your order!</p>
    
    <p>We are pleased to confirm that we have received your order #${
      req?.body?.user?.orderId
    } placed on ${new Date().toDateString()}. Here are the details:</p>
    <p>Your order is now being processed, and you will receive a notification once it has been shipped. You can track your order status using the following link: <a href="${
      req?.body?.tackingUrl
    }">Track Order</a>.</p>
    
    <p>If you have any questions or need further assistance, please do not hesitate to contact our customer support team at support-tastytwist@gmail.com/01234567890.</p>
    
    <p>Thank you for choosing TastyTwist Online Food Service! We hope you enjoy your purchase.</p>
    
    <p>Best regards,</p>
    
    <p>TastyTwist Online Food Service<br>
    tastytwist@gmail.com<br>
    <a href="[Your Website URL]">[Your Website URL]</a></p>
        </div>`,
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

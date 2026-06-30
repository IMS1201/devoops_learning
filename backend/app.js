const express = require("express");
const cors = require("cors");
const itemsRouter = require("./routes/items");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({ message: "get", endpoints: "/items" });
});

app.post("/", (req, res) => {
  const user = req.body.user;
  res.status(200).json({ message: "post " + user });
});

app.use("/items", itemsRouter);

app.listen(8000, () => {
  console.log("app is listenning on port 8000");
});

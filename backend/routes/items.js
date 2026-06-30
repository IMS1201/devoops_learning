const express = require("express");

const router = express.Router();

let items = [
  { id: 1, name: "Learn Docker", description: "Build and run containers" },
  { id: 2, name: "Learn Kubernetes", description: "Deploy with YAML manifests" },
];
let nextId = 3;

router.get("/", (req, res) => {
  res.status(200).json({ items });
});

router.get("/:id", (req, res) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  res.status(200).json({ item });
});

router.post("/", (req, res) => {
  const { name, description } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const item = {
    id: nextId++,
    name: name.trim(),
    description: description?.trim() || "",
  };
  items.push(item);
  res.status(201).json({ item, message: "created" });
});

router.put("/:id", (req, res) => {
  const item = items.find((i) => i.id === Number(req.params.id));
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  const { name, description } = req.body;
  if (name !== undefined) {
    if (!name.trim()) {
      return res.status(400).json({ error: "name cannot be empty" });
    }
    item.name = name.trim();
  }
  if (description !== undefined) {
    item.description = description.trim();
  }
  res.status(200).json({ item, message: "updated" });
});

router.delete("/:id", (req, res) => {
  const index = items.findIndex((i) => i.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: "Item not found" });
  }
  const [deleted] = items.splice(index, 1);
  res.status(200).json({ item: deleted, message: "deleted" });
});

module.exports = router;

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "/bar");

function App() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const showResult = (message, isError = false) => {
    setStatus(message);
    setError(isError ? message : "");
  };

  const fetchAll = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/items`);
      setItems(data.items);
      showResult(`GET all: ${data.items.length} item(s)`);
    } catch (err) {
      showResult(err.response?.data?.error || err.message, true);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const fetchOne = async () => {
    if (!selectedId) {
      showResult("Enter an ID to fetch one item", true);
      return;
    }
    try {
      const { data } = await axios.get(`${API_BASE}/items/${selectedId}`);
      setName(data.item.name);
      setDescription(data.item.description);
      showResult(`GET one: #${data.item.id} "${data.item.name}"`);
    } catch (err) {
      showResult(err.response?.data?.error || err.message, true);
    }
  };

  const createItem = async () => {
    try {
      const { data } = await axios.post(`${API_BASE}/items`, { name, description });
      showResult(`POST created: #${data.item.id} "${data.item.name}"`);
      setName("");
      setDescription("");
      setSelectedId("");
      fetchAll();
    } catch (err) {
      showResult(err.response?.data?.error || err.message, true);
    }
  };

  const updateItem = async () => {
    if (!selectedId) {
      showResult("Enter an ID to update", true);
      return;
    }
    try {
      const { data } = await axios.put(`${API_BASE}/items/${selectedId}`, { name, description });
      showResult(`PUT updated: #${data.item.id} "${data.item.name}"`);
      fetchAll();
    } catch (err) {
      showResult(err.response?.data?.error || err.message, true);
    }
  };

  const deleteItem = async () => {
    if (!selectedId) {
      showResult("Enter an ID to delete", true);
      return;
    }
    try {
      const { data } = await axios.delete(`${API_BASE}/items/${selectedId}`);
      showResult(`DELETE removed: #${data.item.id} "${data.item.name}"`);
      setName("");
      setDescription("");
      setSelectedId("");
      fetchAll();
    } catch (err) {
      showResult(err.response?.data?.error || err.message, true);
    }
  };

  const selectItem = (item) => {
    setSelectedId(String(item.id));
    setName(item.name);
    setDescription(item.description);
    showResult(`Selected #${item.id} for edit/delete`);
  };

  return (
    <div className="app">
      <h1>Full-Stack CRUD Test</h1>
      <p className="api-hint">API: {API_BASE}/items</p>

      <div className="form">
        <label>
          ID (for GET one / PUT / DELETE)
          <input
            type="number"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            placeholder="e.g. 1"
          />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
        </label>
        <label>
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
          />
        </label>
      </div>

      <div className="actions">
        <button type="button" onClick={fetchAll}>GET all</button>
        <button type="button" onClick={fetchOne}>GET one</button>
        <button type="button" onClick={createItem}>POST create</button>
        <button type="button" onClick={updateItem}>PUT update</button>
        <button type="button" className="danger" onClick={deleteItem}>DELETE</button>
      </div>

      {status && <p className={error ? "status error" : "status"}>{status}</p>}

      <section className="list">
        <h2>Items ({items.length})</h2>
        {items.length === 0 ? (
          <p className="empty">No items yet — create one with POST.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className="item-btn" onClick={() => selectItem(item)}>
                  <strong>#{item.id}</strong> {item.name}
                  <span>{item.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;

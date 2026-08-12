const express = require("express");
const router = express.Router();

const { getHistory, sendMessage } = require("../controllers/chatController");
const protect = require("../middleware/authMiddleware");

router.get("/:goalId", protect, getHistory);
router.post("/:goalId", protect, sendMessage);

module.exports = router;
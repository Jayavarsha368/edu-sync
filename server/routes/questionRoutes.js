const express = require("express");
const router = express.Router();

const { generateQuestions, getQuestionSets, deleteQuestionSet } = require("../controllers/questionController");
const protect = require("../middleware/authMiddleware");

router.post("/:goalId", protect, generateQuestions);
router.get("/:goalId", protect, getQuestionSets);
router.delete("/:goalId/:setId", protect, deleteQuestionSet);

module.exports = router;
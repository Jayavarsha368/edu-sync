const express = require("express");
const router = express.Router();

const { getSchedule, updateTask, reallocateDay, autoReschedulePastDays, completeDay } = require("../controllers/scheduleController");
const protect = require("../middleware/authMiddleware");

router.get("/:goalId", protect, getSchedule);
router.patch("/:goalId/task", protect, updateTask);
router.post("/:goalId/reallocate", protect, reallocateDay);
router.post("/:goalId/auto-reschedule", protect, autoReschedulePastDays);
router.post("/:goalId/complete-day", protect, completeDay);

module.exports = router;
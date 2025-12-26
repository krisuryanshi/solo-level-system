import mongoose from "mongoose";

const QuestSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        type: { type: String, enum: ["focus", "strength", "craft"], required: true },
        title: { type: String, required: true },
        xpReward: { type: Number, required: true },
        goldReward: { type: Number, required: true },
        completed: { type: Boolean, default: false },
        completedAt: { type: String, default: null },
    },
    { _id: false }
);

const UserSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        pinHash: { type: String, required: true },
        pinSalt: { type: String, required: true },

        player: {
            level: { type: Number, default: 1 },
            xp: { type: Number, default: 0 },
            gold: { type: Number, default: 0 },
            statPoints: { type: Number, default: 0 },
            stats: {
                focus: { type: Number, default: 0 },
                strength: { type: Number, default: 0 },
                craft: { type: Number, default: 0 },
            },
        },

        activeDay: {
            dayKey: { type: String, default: null },
            startedAt: { type: String, default: null },
        },

        quests: { type: [QuestSchema], default: [] },
    },
    { timestamps: true }
);

export default mongoose.model("User", UserSchema);

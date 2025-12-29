import mongoose from "mongoose";

const QuestSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        kind: { type: String, enum: ["template", "quick"], default: "template" },

        templateId: { type: String, default: null },
        type: { type: String, enum: ["physical", "intellectual", "spiritual"], required: true },
        title: { type: String, required: true },

        minutes: { type: Number, required: true },
        note: { type: String, default: "" },

        xpReward: { type: Number, required: true },   // computed snapshot
        goldReward: { type: Number, required: true }, // computed snapshot

        completed: { type: Boolean, default: false },
        completedAt: { type: String, default: null },
    },
    { _id: false }
);

const UserSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        passwordHash: { type: String, required: true },
        passwordSalt: { type: String, required: true },

        player: {
            level: { type: Number, default: 1 },
            xp: { type: Number, default: 0 },
            gold: { type: Number, default: 0 },
            statPoints: { type: Number, default: 0 },
            stats: {
                physical: { type: Number, default: 0 },
                intellectual: { type: Number, default: 0 },
                spiritual: { type: Number, default: 0 },
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

import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        title: { type: String, required: true, trim: true },
        type: { type: String, enum: ["physical", "intellectual", "spiritual"], required: true },
        minutes: { type: Number, required: true }, // default minutes
        archived: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export default mongoose.model("Template", TemplateSchema);

import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema()
export class User extends Document{
  @Prop({ required: true })
name: string;

@Prop({ required: true, unique: true })
email: string;

@Prop({
  required: function () {
    return !this.isGoogleUser;
  },
})
number?: string; 

@Prop()
address: string;

@Prop()
wardNo: string;

@Prop({
  required: function () {
    return !this.isGoogleUser;
  },
})
password?: string;

@Prop({ default: false })
isGoogleUser: boolean;

@Prop({ default: false })
isProfileComplete: boolean;

@Prop({ default: true })
spikeAlertsEnabled: boolean;

@Prop({ default: false })
isAdmin: boolean;

@Prop({ default: 0 })
xp: number;

@Prop({ default: 5 })
hearts: number;

@Prop({ default: 5 })
maxHearts: number;

@Prop()
lastHeartsRefillAt?: Date;

@Prop({ default: 0 })
streakDays: number;

@Prop()
lastLearningAt?: Date;

@Prop({ type: [String], default: [] })
badges: string[];

@Prop({ default: 0 })
lessonsCompletedCount: number;

@Prop({ default: 0 })
correctQuizAnswers: number;

@Prop({ default: 3 })
streakFreezes: number;

@Prop({ default: 3 })
maxStreakFreezes: number;

@Prop({ default: 0 })
streakFreezeUsedCount: number;

@Prop({ type: [String], default: [] })
learningActivityDates: string[];

}
export const UserSchema= SchemaFactory.createForClass(User);

// Unique only when number exists as a string (allows multiple docs without number)
UserSchema.index(
  { number: 1 },
  {
    unique: true,
    partialFilterExpression: { number: { $type: 'string' } },
  },
);

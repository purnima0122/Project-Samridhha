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

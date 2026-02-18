import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { signupDto } from './dtos/signup.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { loginDto } from './dtos/login.dto';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from './schemas/refresh.token.schema';
import { randomUUID } from 'crypto';
import { nanoid } from 'nanoid';
import { ResetToken } from './schemas/reset.token.schema';
import { MailService } from 'src/services/mail.service';


@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)private UserModel: Model<User>,
    @InjectModel(RefreshToken.name)private RefreshTokenModel: Model<RefreshToken>,
    @InjectModel(ResetToken.name)private ResetTokenModel: Model<ResetToken>,
  private jwtService: JwtService,
  private mailService: MailService,
){}

  async signup(signupData: signupDto) {
  const rawName = signupData.name ?? '';
  const rawEmail = signupData.email ?? '';
  const rawNumber = signupData.number ?? '';
  const rawAddress = signupData.address ?? '';
  const rawWardNo = signupData.wardNo ?? '';
  const name = rawName.trim();
  const email = rawEmail.trim().toLowerCase();
  const number = rawNumber.replace(/\s+/g, '');
  const address = rawAddress.trim();
  const wardNo = rawWardNo.trim();
  const { password } = signupData;

  if (!email || !number || !password || !name || !address || !wardNo) {
    throw new BadRequestException('Please fill all the fields');
  }

  // Check email
  const emailInUse = await this.UserModel.findOne({ email });
  if (emailInUse) {
    throw new BadRequestException('Email is already in use');
  }

  // Check phone number (number)
  const phoneInUse = await this.UserModel.findOne({ number });
  if (phoneInUse) {
    throw new BadRequestException('Phone number is already in use');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  try {
    await this.UserModel.create({
    name,
    email,
    number,     
    address,
    wardNo,
    password: hashedPassword,
    isGoogleUser: false,
    isProfileComplete: true,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'value';
      throw new BadRequestException(`Duplicate value for ${duplicateField}`);
    }
    throw error;
  }

  return { message: 'Signup successful' };
}

  async login(credentials:loginDto){
    const email = credentials.email?.trim().toLowerCase();
    const {password}=credentials;

    if (!email || !password) {
      throw new UnauthorizedException('Wrong Credentials');
    }

    //find if user exists by email
    
     const user= await this.UserModel.findOne({email});
     if(!user){
      throw new UnauthorizedException('Wrong Credentials');
     }

    if (!user.password) {
      throw new UnauthorizedException('Wrong Credentials');
    }

    //compare entered password with existing password 
    const passwordMatch =await bcrypt.compare(password, user.password)
    if(!passwordMatch){
      throw new UnauthorizedException('Wrong credentails');
    }

    //generate jwt tokens 
    
    const tokens=await this.generateUserTokens(user._id);
    return {
      ...tokens,
      userId:user._id,
    }
  }

    //change password 
  async changePassword(userId, oldPassword:string, newPassword: string)
  {
    //find the user
    const user= await this.UserModel.findById(userId);
    if(!user){
      throw new NotFoundException('User not found...');
    }

    if (user.isGoogleUser || !user.password) {
      throw new BadRequestException('Password change not available for Google users');
    }

    //compare the old password with the password in the database
    const passwordMatch =await bcrypt.compare(oldPassword, user.password)
     if(!passwordMatch){
      throw new UnauthorizedException('Wrong credentails');
    }

    //change user's password( don't forget to hash it)
    const newHashedPassword = await bcrypt.hash(newPassword,10);
    user.password= newHashedPassword;
    await user.save();

    return { message: 'Password changed successfully' };
  }

  //forgot password 
  async forgotPassword(email:string)
  {
    //check if the user exists
    const user= await this.UserModel.findOne({email});

    if(user)
    {
    //if user exits, generate a password reset link 
    const expiryDate= new Date();
    expiryDate.setHours(expiryDate.getHours()+1);
    const resetToken= nanoid(64);
    await this.ResetTokenModel.create({
     token: resetToken,
      userId: user._id,
      expiryDate
    });
    //send the link to the user via email( using nodemailer/SES/etc...)

     await this.mailService.sendPasswordResetEmail(email,resetToken);
    }

    
    return {"message":"If this user exits, they will receive an email"};
  
  }

















  
  async loginWithGoogle(user: any) {
  const tokens = await this.generateUserTokens(user._id);

  return {
    ...tokens,
    userId: user._id,
  };
}



  //reset password 
  async resetPassword(newPassword:string, resetToken:string){
    //find a valid reset token document
    const token=await this.ResetTokenModel.findOneAndDelete({
      token:resetToken,
      expiryDate: {$gte:new Date()},
    });
    
    if(!token){
      throw new UnauthorizedException('Invalid link');
    }

    //change the user password(dont forget to hash it)
    const user= await this.UserModel.findById(token.userId);
    if(!user){
      throw new InternalServerErrorException();
    }
    user.password=await bcrypt.hash(newPassword, 10);
    await user.save();

    return { message: 'Password reset successfully' };
  }

  async refreshTokens(refreshToken:string){
    const token= await this.RefreshTokenModel.findOne({
      token:refreshToken,
      expiryDate:{ $gte: new Date()}
    });
    if(!token){
      throw new UnauthorizedException('Refresh token is invalid');
    }
    return this.generateUserTokens(token.userId)
  }

  //separate function to generate usertoken to make the code modular
  async generateUserTokens(userId){
    const accessToken =this.jwtService.sign({userId},{expiresIn: '72 hr'});

    const RefreshToken=randomUUID();

    await this.storeRefreshToken(RefreshToken,userId)
    return {
      accessToken,//short lived
      RefreshToken// long lived
    };
  }


  async storeRefreshToken(token:string,userId){
    //expiry date is calculated to be three days from now 
    const expiryDate= new Date();
    expiryDate.setDate(expiryDate.getDate()+3);
    await this.RefreshTokenModel.updateOne({userId},
      {$set: {expiryDate,token}},
      {
        upsert:true,
      }
    );
  }

async validateGoogleUser(googleUser: {
  email: string;
  name: string;
  avatar?: string;
}) {
  let user = await this.UserModel.findOne({ email: googleUser.email });

  // If user does NOT exist → create one
  if (!user) {
    try {
      user = await this.UserModel.create({
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.avatar,
        password: null,          // Google users don't have passwords
        isGoogleUser: true,
        isProfileComplete: false,
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        const duplicateField =
          Object.keys(error.keyPattern || {})[0] || 'value';
        throw new BadRequestException(`Duplicate value for ${duplicateField}`);
      }
      throw error;
    }
  }

  return user;
}


}


import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from 'src/auth/schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  async getMe(userId: string) {
    const user = await this.userModel
      .findById(new Types.ObjectId(userId))
      .select('name email number address wardNo isProfileComplete isGoogleUser')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateMe(
    userId: string,
    payload: {
      name?: string;
      number?: string;
      address?: string;
      wardNo?: string;
    },
  ) {
    const name = payload.name?.trim();
    const number = payload.number?.replace(/\s+/g, '');
    const address = payload.address;
    const wardNo = payload.wardNo?.trim();

    if (!name || !number || !address || !wardNo) {
      throw new BadRequestException('Please fill all the fields');
    }

    const userObjectId = new Types.ObjectId(userId);
    const existingPhone = await this.userModel.findOne({
      number,
      _id: { $ne: userObjectId },
    });
    if (existingPhone) {
      throw new BadRequestException('Phone number is already in use');
    }

    const updated = await this.userModel.findByIdAndUpdate(
      userObjectId,
      {
        name,
        number,
        address,
        wardNo,
        isProfileComplete: true,
      },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return updated;
  }
}

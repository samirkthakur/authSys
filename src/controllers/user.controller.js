import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import {User} from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler( async (req, res) => {

// recieved request
// return response to take data as required in user data model
// save the data in DB
// return success confirmation

        // OR

// get user details from frontend (postman)

    const {fullName, userName, email, password} = req.body
    // console.log("email: ", email)

    /*if(fullName === ""){
        throw new apiError(400, "fullname is required")
    }*/

// validation - not empty    

    if(
        [fullName, email, userName, password].some((field) =>
        field?.trim() === "")
    ){
        throw new apiError(400, "All fields are required")
    }

// check if user already exists: username, email

    const existedUser = await User.findOne({
        $or: [{userName}, {email}]
    })

    if(existedUser){
        throw new apiError(409, "User with email or username already exists")
    }
    // console.log(req.files)

// check for images, check for avatar

    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files?.coverImage[0]?.path
    }

    if(!avatarLocalPath){
        throw new apiError(400, "Avatar is required")
    }

// upload them to cloudinary, avatar

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)


    if(!avatar){
        throw new apiError(400, "Avaatr is required")
    }

// create user object - create entry in DB

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        userName: userName.toLowerCase()
    })

// remove password and refresh token field from response

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

// check for user creation

    if(!createdUser){
        throw new apiError(500, "Something went wrong while registration")
    }

// return response

    return res.status(201).json(
        new apiResponse(200, createdUser, "User registered successfully")
    )
})


export {registerUser}
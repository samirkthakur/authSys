import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from "../utils/apiError.js"
import {User} from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new apiError(500, "something went wrong while generating tokens")
    }
}

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

const loginUser = asyncHandler(async (req, res) => {
    // get email and password from user
    // validation - not empty
    // check if email and password exist in the database
    // create access and refresh tokens
    // return appropriate response

    //          OR

    // req.body -> data

    const {userName, email, password} = req.body
    // username or email

    if(!userName && !email){
        throw new apiError(400, "username or email is required")
    }
    // find the user

    const user = await User.findOne({
        $or: [{userName}, {email}]
    })
    if(!user){
        throw new apiError(400, "user does not exist")
    }
    // password check

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new apiError(402, "invalid password")
    }
    // access and refresh tokens

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    // send cookie

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new apiResponse(200, {
            user: loggedInUser, accessToken, refreshToken
        }, "user logged in successfully")
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,{
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )


    // clear the cookies
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "user logged out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new apiError(403, "unauthorized request")
    }
    
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.ACCESS_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new apiError(403, "invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new apiError(401, "refresh token is expired or used")
        }
        const options = {
            httpOnly: true,
            secure: true
        }
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new apiResponse(200, {
                accessToken,
                refreshToken: newRefreshToken},
                "access token refreshed"
            )
        )
    } catch (error) {
        throw new apiError(402, error?.message || "invalid refresh token")
    }
})

export {registerUser, loginUser, logoutUser, refreshAccessToken}
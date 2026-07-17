import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

export async function POST(request) {
  try {
    const formData = await request.formData();

    const file = formData.get("image");

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          message: "No image provided",
        },
        {
          status: 400,
        }
      );
    }


    // Allowed image types
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
    ];


    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          message: "Only JPG, PNG and WEBP images are allowed",
        },
        {
          status: 400,
        }
      );
    }


    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);


    // Create unique filename
    const extension = file.name.split(".").pop();

    const fileName = `${uuid()}.${extension}`;


    // Upload directory
    const uploadDir = path.join(
      process.cwd(),
      "public/uploads/images"
    );


    // Create folder if not exists
    await mkdir(uploadDir, {
      recursive: true,
    });


    // Save image
    const filePath = path.join(
      uploadDir,
      fileName
    );


    await writeFile(filePath, buffer);



    // Save this URL in Neon database
    const imageUrl = `/uploads/images/${fileName}`;


    return NextResponse.json(
      {
        success: true,
        message: "Image uploaded successfully",
        imageUrl,
      },
      {
        status: 200,
      }
    );


  } catch (error) {

    console.error("Upload Error:", error);

    return NextResponse.json(
      {
        success:false,
        message:"Server error",
        error:error.message
      },
      {
        status:500
      }
    );
  }
}
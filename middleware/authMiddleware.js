import jwt from "jsonwebtoken";
import Mr from "../models/Mr.js";
import Organization from "../models/Organization.js";

// MR Auth Middleware
export const auth = async (req, res, next) => {
  // console.log("🔹 Cookies received in auth:", req.cookies); 
  try {
    const token =
      req.cookies.token || req.headers["authorization"]?.split(" ")[1];
//console.log("🔹 Received token:", token)
    if (!token) return res.status(401).json({ message: "Unauthorized - No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //console.log("Decoded token:", decoded);
    const mr = await Mr.findById(decoded.id);
    if (!mr) return res.status(401).json({ message: "Unauthorized - Invalid MR" });

    req.mr = mr;
    console.log("🔹 MR in auth middleware:", mr);

    next();
  } catch (error) {
    console.error("Auth Error:", error.message);
    res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};

// Organization Auth
export const orgAuth = async (req, res, next) => {
   console.log("🔹 Cookies received in auth:", req.cookies); 
  try {
    const token =
      req.cookies.orgToken || req.headers["authorization"]?.split(" ")[1];

    if (!token)
      return res.status(401).json({ message: "Unauthorized - No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //console.log("Decoded  org auth token:", decoded);
    const org = await Organization.findById(decoded.id);
    if (!org)
      return res.status(401).json({ message: "Unauthorized - Invalid org" });

    req.organization = org;
    next();
  } catch (error) {
    console.error("Org Auth Error:", error.message);
    res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};
// middleware/authMiddleware.js


export const authOrOrg = async (req, res, next) => {
  try {
    let token = null;

    // 1️⃣ Try Bearer header first (used by mobile)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2️⃣ Fallback to cookies (used by web)
    if (!token && (req.cookies.token || req.cookies.orgToken)) {
      token = req.cookies.token || req.cookies.orgToken;
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    // 3️⃣ Verify and find either MR or Organization
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try to find MR
    const mr = await Mr.findById(decoded.id);
    if (mr) {
      req.mr = mr;
      console.log("🔹 MR in auth middleware:", mr);

      return next();
    }

    // Try to find Organization
    const org = await Organization.findById(decoded.id);
    if (org) {
      req.organization = org;
      return next();
    }

    return res.status(401).json({ message: "Unauthorized - No valid user" });
  } catch (err) {
    console.error("AuthOrOrg Error:", err.message);
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};














































// import jwt from 'jsonwebtoken';
// import Mr from '../models/Mr.js';
// import Organization from '../models/Organization.js';

// // MR Auth Middleware
// export const auth = async (req, res, next) => {
//   try {
//     let token;

//     // 1️⃣ Check Authorization header first
//     const authHeader = req.headers.authorization;
//     if (authHeader && authHeader.startsWith('Bearer ')) {
//       token = authHeader.split(' ')[1];
//     }

//     // 2️⃣ Fallback to cookie
//     if (!token && req.cookies.token) {
//       token = req.cookies.token;
//     }

//     if (!token) return res.status(401).json({ message: 'Unauthorized' });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.mr = await Mr.findById(decoded.id);

//     next();
//   } catch (error) {
//     console.error('Auth Middleware Error:', error.message);
//     return res.status(401).json({ message: 'Unauthorized' });
//   }
// };

// // Organization Auth Middleware
// export const orgAuth = async (req, res, next) => {
//   try {
//     let token;

//     // Check Authorization header first
//     const authHeader = req.headers.authorization;
//     if (authHeader && authHeader.startsWith('Bearer ')) {
//       token = authHeader.split(' ')[1];
//     }

//     // Fallback to cookie
//     if (!token && req.cookies.orgToken) {
//       token = req.cookies.orgToken;
//     }

//     if (!token) return res.status(401).json({ message: 'Unauthorized' });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.organization = await Organization.findById(decoded.id);

//     next();
//   } catch (error) {
//     console.error('Org Auth Middleware Error:', error.message);
//     return res.status(401).json({ message: 'Unauthorized' });
//   }
// };




// import jwt from 'jsonwebtoken';
// import Mr from '../models/Mr.js';
// import Organization from '../models/Organization.js';

// export const auth = async (req, res, next) => {
//   try {
//     const token = req.cookies.token;
//     if (!token) return res.status(401).json({ message: 'Unauthorized' });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.mr = await Mr.findById(decoded.id);
//     next();
//   } catch {
//     return res.status(401).json({ message: 'Unauthorized' });
//   }
// };

// export const orgAuth = async (req, res, next) => {
//   try {
//     const token = req.cookies.orgToken;
//     if (!token) return res.status(401).json({ message: 'Unauthorized' });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.organization = await Organization.findById(decoded.id);
//     next();
//   } catch {
//     return res.status(401).json({ message: 'Unauthorized' });
//   }
// };



// export const checkRole = (role) => (req, res, next) => {
//   if (req.user.role !== role ) {
//     return res.status(403).json({ message: 'Forbidden' });
//    }
//    next();
//  };

//  export const orgcheckRole = (role) => (req, res, next) => {
//  if (req.organization.role !== role ) {
//    return res.status(403).json({ message: 'Forbidden' });
//  }   next();
//  };

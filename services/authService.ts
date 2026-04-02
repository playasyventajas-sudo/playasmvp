import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  writeBatch
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "./firebaseConfig";
import { updateMockOffersMerchantName } from "./dataService";
import { CompanyUser } from "../types";

// Mock user for demo mode
const MOCK_USER: CompanyUser = {
  uid: "mock-user-123",
  email: "demo@company.com",
  companyName: "Demo Beach Bar",
  cnpj: "00.000.000/0001-00"
};

export const registerCompany = async (email: string, pass: string, companyName: string, cnpj: string): Promise<CompanyUser> => {
  if (!isFirebaseConfigured()) {
    console.log("Demo Mode: Registering user", { email, companyName });
    return { ...MOCK_USER, email, companyName, cnpj };
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;
    
    const companyData = {
      uid: user.uid,
      email: user.email || email,
      companyName,
      cnpj,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "companies", user.uid), companyData);

    return {
      uid: user.uid,
      email: user.email || email,
      companyName,
      cnpj
    };
  } catch (error) {
    console.error("Error registering company:", error);
    throw error;
  }
};

export const loginCompany = async (email: string, pass: string): Promise<CompanyUser> => {
  if (!isFirebaseConfigured()) {
    console.log("Demo Mode: Logging in user", email);
    if (email === "demo@error.com") throw new Error("Demo error");
    return MOCK_USER;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const user = userCredential.user;
    
    // Fetch extra data from Firestore
    const docRef = doc(db, "companies", user.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as CompanyUser;
      const authEmail = user.email || email;
      if (authEmail && data.email !== authEmail) {
        await updateDoc(docRef, {
          email: authEmail,
          updatedAt: serverTimestamp()
        });
        return { ...data, email: authEmail };
      }
      return { ...data, email: authEmail };
    }
    return {
      uid: user.uid,
      email: user.email || email,
      companyName: user.displayName || "Company",
      cnpj: ""
    };
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
};

export const logoutCompany = async () => {
  if (!isFirebaseConfigured()) {
    console.log("Demo Mode: Logging out");
    return;
  }
  await signOut(auth);
};

/** Atualiza nome do estabelecimento em `companies` e em todas as ofertas do mesmo dono. */
export const updateCompanyDisplayName = async (
  uid: string,
  companyName: string
): Promise<void> => {
  const trimmed = companyName.trim();
  if (!trimmed) throw new Error("empty name");

  if (!isFirebaseConfigured()) {
    updateMockOffersMerchantName(uid, trimmed);
    return;
  }

  await updateDoc(doc(db, "companies", uid), {
    companyName: trimmed,
    updatedAt: serverTimestamp()
  });

  const q = query(collection(db, "offers"), where("ownerUid", "==", uid));
  const snap = await getDocs(q);
  let batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    batch.update(d.ref, { merchantName: trimmed });
    n++;
    if (n >= 500) {
      await batch.commit();
      batch = writeBatch(db);
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
};

export const resetPassword = async (email: string) => {
  if (!isFirebaseConfigured()) {
    console.log("Demo Mode: Sending reset email to", email);
    return;
  }
  const actionCodeSettings =
    typeof window !== "undefined"
      ? {
          url: `${window.location.origin}/`,
          handleCodeInApp: false
        }
      : undefined;
  await sendPasswordResetEmail(auth, email, actionCodeSettings);
};

export const subscribeToAuthChanges = (callback: (user: CompanyUser | null) => void) => {
  if (!isFirebaseConfigured()) {
    // In demo mode, we don't have real auth state changes driven by backend
    // The app will handle state locally for demo
    return () => {};
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const docRef = doc(db, "companies", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as CompanyUser;
        callback({ ...data, email: user.email || data.email });
      } else {
        callback({
          uid: user.uid,
          email: user.email || "",
          companyName: user.displayName || "Company",
          cnpj: ""
        });
      }
    } else {
      callback(null);
    }
  });
};

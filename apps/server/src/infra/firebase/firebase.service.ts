import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";

@Injectable()
export class FirebaseService {
    readonly auth: Auth;

    constructor(config: ConfigService) {
        const app =
            getApps()[0] ??
            initializeApp({
                credential: cert({
                    projectId: config.getOrThrow<string>("FIREBASE_PROJECT_ID"),
                    clientEmail: config.getOrThrow<string>("FIREBASE_CLIENT_EMAIL"),
                    privateKey: config.getOrThrow<string>("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
                }),
            });
        this.auth = getAuth(app);
    }
}
'use client'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/firebase/firebase-client";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type UserData = {
    id: string; // Document ID
    username: string;
    email: string;
    role: string;
    createdAt?: any;
}

export default function UsersTable() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("createdAt", "desc")); // Optional formatting

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedUsers: UserData[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                fetchedUsers.push({
                    id: doc.id,
                    username: data.username || "N/A",
                    email: data.email || "N/A",
                    role: data.role || "user",
                    createdAt: data.createdAt
                });
            });
            setUsers(fetchedUsers);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching users:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return <div className="text-sm text-muted-foreground p-4">Loading users...</div>;
    }

    if (users.length === 0) {
        return <div className="text-sm text-muted-foreground p-4">No users found.</div>;
    }

    return (
        <div className="rounded-md border bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>{user.username}</TableCell>
                            <TableCell className="font-light italic">{user.email}</TableCell>
                            <TableCell>
                                <Badge variant={user.role === 'admin' ? 'default' : user.role === 'manager' ? 'secondary' : 'outline'}>
                                    {user.role}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

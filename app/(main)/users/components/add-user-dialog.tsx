'use client'

import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { auth, db } from "@/lib/firebase/firebase-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";

const formSchema = z.object({
    username: z.string().min(1, "Username is required"),
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    role: z.string().min(1, "Role is required"),
})

type FormOutput = z.infer<typeof formSchema>

function generateRandomPassword() {
    const length = 10;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
}

export default function AddUserDialog() {
    const [open, setOpen] = useState(false)
    const [confirmClose, setConfirmClose] = useState(false)

    const form = useForm<FormOutput>({
        defaultValues: {
            username: "",
            email: "",
            role: "user",
        },
        resolver: zodResolver(formSchema),
        mode: "onSubmit",
        reValidateMode: "onSubmit",
    })

    async function onSubmit(data: FormOutput) {
        let userCredential;
        try {
            const password = generateRandomPassword();
            userCredential = await createUserWithEmailAndPassword(auth, data.email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                username: data.username,
                email: data.email,
                role: data.role,
                firstSignIn: true,
                createdAt: serverTimestamp(),
            });

            console.log(`User created with password: ${password}`); // Log password for development/testing

            // Send email notification
            const emailResponse = await fetch("/api/send-email", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: data.email,
                    subject: "Welcome to Stuttgart App",
                    html: `
                        <h1>Welcome to Stuttgart App</h1>
                        <p>Your account has been created successfully.</p>
                        <p><strong>Username:</strong> ${data.username}</p>
                        <p><strong>Email:</strong> ${data.email}</p>
                        <p><strong>Password:</strong> ${password}</p>
                        <p>Please log in and change your password immediately.</p>
                    `,
                }),
            });

            if (!emailResponse.ok) {
                throw new Error("Failed to send welcome email");
            }

            form.reset()
            setOpen(false)
        } catch (error) {
            console.error("Failed to add user or send email", error)

            // Rollback if user was created but process failed
            if (userCredential && userCredential.user) {
                try {
                    await deleteDoc(doc(db, "users", userCredential.user.uid));
                    await userCredential.user.delete();
                    console.log("Rolled back user creation");
                } catch (rollbackError) {
                    console.error("Failed to rollback user creation", rollbackError);
                }
            }

            form.setError("root", { message: "Failed to create user. Please try again." });
        }
    }

    function handleCancel() {
        if (form.formState.isDirty) {
            setConfirmClose(true)
        } else {
            form.reset()
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Form {...form}>
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                    </Button>
                </DialogTrigger>
                <DialogContent className="w-[500px]">
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <DialogHeader className="pb-4">
                            <DialogTitle>Add a New User</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
                            <div className="flex flex-col gap-4">
                                <div className="grid gap-4">
                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem className="grid grid-cols-3 gap-x-4">
                                                <FormLabel>Username</FormLabel>
                                                <FormControl className="col-span-2">
                                                    <Input
                                                        type="text"
                                                        placeholder="johndoe"
                                                        className="w-full  px-3 py-2 border border-gray-300 rounded-md"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem className="grid grid-cols-3 gap-x-4">
                                                <FormLabel>Email</FormLabel>
                                                <FormControl className="col-span-2">
                                                    <Input
                                                        type="email"
                                                        placeholder="user@example.com"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="role"
                                        render={({ field }) => (
                                            <FormItem className="grid grid-cols-3 gap-x-4">
                                                <FormLabel>Role</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl className="col-span-2">
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select a role" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="user">User</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                        <SelectItem value="manager">Manager</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="mt-4">
                            <Button type="submit">Submit</Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                            >Cancel</Button>
                        </DialogFooter>
                    </form>
                </DialogContent >

                <ConfirmationDialog
                    open={confirmClose}
                    onOpenChange={setConfirmClose}
                    onConfirm={() => {
                        form.reset()
                        setConfirmClose(false)
                        setOpen(false)
                    }}
                />
            </Form>
        </Dialog >
    )
}
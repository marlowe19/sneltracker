This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Time tracking setup (Firestore)

1. Create a Firebase project and a service account with Firestore access.
2. Download the service account JSON and base64-encode it:
   ```bash
   base64 -i serviceAccount.json | tr -d '\n'
   ```
3. Add to `.env.local`:
   ```bash
   FIREBASE_SERVICE_ACCOUNT_JSON="<BASE64_OF_SERVICE_ACCOUNT_JSON>"
   ```
   On Vercel, add the same env var in Project Settings → Environment Variables.
4. First run will create documents in the `time_entries` collection. No SQL database is required.
5. Use URLs like `/kevin/start` to start and `/kevin/stop` to stop. After starting or stopping you'll be redirected to `/<user>` where the timer and weekly overview are shown.
6. If Firestore prompts for composite indexes, accept the suggestions. For active-entry queries, create an index on: `user_name ASC`, `end_time ASC`, `start_time DESC`.


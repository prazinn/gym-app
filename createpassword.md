Viewed seed.js:21-42

You can create new users in two ways: by updating your **`seed.js`** file or by using a quick **terminal command**.

### Option 1: Update `seed.js` (Best for permanent users)
You can simply add more users to your `seed.js` file. For example, to add a second admin, you could add this block after line 25:

```javascript
  // Create another Admin
  const admin2Hash = await bcrypt.hash('newadminpassword', 12);
  await prisma.user.upsert({
    where: { username: 'prazin' },
    update: {},
    create: {
      username: 'prazin',
      email: 'prazin@gymtrack.com',
      passwordHash: admin2Hash,
      role: 'admin',
    },
  });
```
Then run: `npm run db:seed`

---

### Option 2: Use a Terminal Command (Fastest)
I have created a quick way for you to generate a user directly from your terminal. Just run this command (replace the values with yours):

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const bcrypt = require('bcryptjs'); const p = new PrismaClient(); async function run() { const hash = await bcrypt.hash('YOUR_PASSWORD', 12); await p.user.create({ data: { username: 'YOUR_NAME', email: 'YOUR_EMAIL', passwordHash: hash, role: 'admin' } }); console.log('User created!'); } run();"
```
*(Change `role: 'admin'` to `role: 'staff'` if you want a staff member).*

---

### Option 3: Via DBeaver
If you are already inside DBeaver:
1.  Generate a hash for your password using this command:
    `node -e "console.log(require('bcryptjs').hashSync('mypassword', 12))"`
2.  Open the `User` table in DBeaver.
3.  Add a new row and paste the **username**, **email**, **role**, and the **hash** you just generated.
4.  Save changes.

**Which method would you like me to help you with?** I can modify the `seed.js` file for you if you give me the names you want to add!
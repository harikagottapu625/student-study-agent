import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const usersFile = resolve(process.cwd(), 'data', 'users.json');

const readUsers = async () => {
  try {
    const content = await readFile(usersFile, 'utf8');
    const users = JSON.parse(content);
    return Array.isArray(users) ? users : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Unable to read local user store: ${error.message}`);
  }
};

const writeUsers = async (users) => {
  await mkdir(dirname(usersFile), { recursive: true });
  await writeFile(usersFile, `${JSON.stringify(users, null, 2)}\n`, 'utf8');
};

export const findLocalUser = async (email) => {
  const users = await readUsers();
  return users.find((user) => user.email === email) || null;
};

export const createLocalUser = async (user) => {
  const users = await readUsers();
  if (users.some((existingUser) => existingUser.email === user.email)) {
    return null;
  }

  const savedUser = {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    passwordSalt: user.passwordSalt,
    createdAt: new Date().toISOString(),
  };
  users.push(savedUser);
  await writeUsers(users);
  return savedUser;
};

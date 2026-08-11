// ==================================================================
// User service - business logic for the user module.
// ==================================================================
import bcrypt from 'bcryptjs';
import { conflictError, notFoundError } from '../../../shared/errors.js';
import { userRepository } from '../repositories/user.repository.js';

const PASSWORD_ROUNDS = 10;

async function createUser(input) {
  if (await userRepository.existsByPhone(input.phone)) {
    throw conflictError('A user with this phone number already exists');
  }
  if (input.email && (await userRepository.findByEmail(input.email))) {
    throw conflictError('A user with this email already exists');
  }

  const passwordHash = input.password ? await bcrypt.hash(input.password, PASSWORD_ROUNDS) : null;

  const user = await userRepository.create({
    phone: input.phone,
    name: input.name ?? null,
    email: input.email ?? null,
    passwordHash,
  });

  return toPublic(user);
}

async function getUserById(id) {
  const user = await userRepository.findById(id);
  if (!user) throw notFoundError('User not found');
  return toPublic(user);
}

async function getUserByPhone(phone) {
  const user = await userRepository.findByPhone(phone);
  if (!user) throw notFoundError('User not found');
  return toPublic(user);
}

async function updateUser(id, input) {
  await getUserById(id); // throws 404 if missing

  const data = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing && existing.id !== id) {
      throw conflictError('A user with this email already exists');
    }
    data.email = input.email;
  }
  if (input.registrationStatus !== undefined) data.registrationStatus = input.registrationStatus;
  if (input.password !== undefined) {
    data.passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);
  }

  const user = await userRepository.update(id, data);
  return toPublic(user);
}

async function userExists(phone) {
  const found = await userRepository.existsByPhone(phone);
  return { exists: Boolean(found) };
}

function toPublic(user) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    email: user.email,
    registrationStatus: user.registrationStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const userService = {
  createUser,
  getUserById,
  getUserByPhone,
  updateUser,
  userExists,
};

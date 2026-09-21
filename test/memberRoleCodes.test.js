// ==================================================================
// The flow's answers -> the codes IPRS's own database uses.
//
// WHY THIS IS PINNED: writing the answer text into these columns instead of the codes is a bug
// this project has now hit three times (ApplicantPath, EntityType, RollTypeIds). The values below
// were read off the live mraai_uat database - if a test here fails, check that database before
// "fixing" the expectation.
// Run: npm test
// ==================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLISHER_ROLL_TYPE_ID_BY_REG_TYPE,
  describeEntityType,
  describeRegType,
  describeRollTypeIds,
  resolveEntityType,
  resolveRegType,
  resolveRollTypeIds,
} from '../src/modules/registration/services/memberRoleCodes.js';

test('each of the four path answers maps to its registration-type code', () => {
  assert.equal(resolveRegType('(Individual) Author / Composer'), 'I');
  assert.equal(resolveRegType('(NRI) Author / Composer'), 'NI');
  assert.equal(resolveRegType('Owner/Publisher'), 'C');
  assert.equal(resolveRegType('(NRI) Owner/Publisher'), 'NC');
});

test('an unrecognised path answer resolves to null rather than being stored raw', () => {
  assert.equal(resolveRegType('Something else entirely'), null);
  assert.equal(resolveRegType(''), null);
  assert.equal(resolveRegType(null), null);
});

test('the role answer maps to different ids on the individual and NRI paths', () => {
  assert.equal(resolveRollTypeIds('I', 'Lyricist'), '2');
  assert.equal(resolveRollTypeIds('I', 'Composer'), '1');
  assert.equal(resolveRollTypeIds('I', 'Both'), '2,1');

  assert.equal(resolveRollTypeIds('NI', 'Lyricist'), '6');
  assert.equal(resolveRollTypeIds('NI', 'Composer'), '5');
  assert.equal(resolveRollTypeIds('NI', 'Both'), '6,5');
});

test('the publisher paths never reach the role question, so their ids come from the path', () => {
  assert.equal(PUBLISHER_ROLL_TYPE_ID_BY_REG_TYPE.C, '4');
  assert.equal(PUBLISHER_ROLL_TYPE_ID_BY_REG_TYPE.NC, '11');
  // ...and asking for a role on those paths resolves to nothing, rather than a wrong id.
  assert.equal(resolveRollTypeIds('C', 'Lyricist'), null);
  assert.equal(resolveRollTypeIds('NC', 'Both'), null);
});

test('an unknown reg type or role answer resolves to null', () => {
  assert.equal(resolveRollTypeIds('I', 'Producer'), null);
  assert.equal(resolveRollTypeIds(undefined, 'Both'), null);
});

test('the entity-type answer maps to IPRS own CP/PR/SP codes', () => {
  // Their team confirmed these: their six categories are Individual / Sole Proprietor /
  // Partnership / Company / NRI Individual / NRI Company - AccountRegType + EntityType together.
  assert.equal(resolveEntityType('Corporate (Pvt Ltd/Ltd Company)'), 'CP');
  assert.equal(resolveEntityType('Partnership'), 'PR');
  assert.equal(resolveEntityType('Sole Proprietary Concern'), 'SP');
  assert.equal(resolveEntityType('Something else'), null);
  assert.equal(resolveEntityType(''), null);
});

test('stored codes turn back into what the member actually picked', () => {
  // A member checking their own details must never be shown "I" or "2,1".
  assert.equal(describeRegType('I'), '(Individual) Author / Composer');
  assert.equal(describeRegType('NC'), '(NRI) Owner/Publisher');
  assert.equal(describeRegType('nonsense'), null);

  assert.equal(describeRollTypeIds('2'), 'Lyricist');
  assert.equal(describeRollTypeIds('1'), 'Composer');
  assert.equal(describeRollTypeIds('2,1'), 'Both');
  assert.equal(describeRollTypeIds('6,5'), 'Both', 'the NRI pair reads the same way');
  assert.equal(describeRollTypeIds('4'), 'Publisher');
  assert.equal(describeRollTypeIds('11'), 'Publisher');
  assert.equal(describeRollTypeIds(''), null);
  assert.equal(describeRollTypeIds('99'), null);

  assert.equal(describeEntityType('CP'), 'Corporate (Pvt Ltd/Ltd Company)');
  assert.equal(describeEntityType('PR'), 'Partnership');
  assert.equal(describeEntityType('SP'), 'Sole Proprietary Concern');
  assert.equal(describeEntityType('ZZ'), null);
});

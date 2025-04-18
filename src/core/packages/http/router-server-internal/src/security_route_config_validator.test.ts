/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { validRouteSecurity } from './security_route_config_validator';
import { ReservedPrivilegesSet } from '@kbn/core-http-server';

describe('RouteSecurity validation', () => {
  it('should pass validation for valid route security with authz enabled and valid required privileges', () => {
    expect(() =>
      validRouteSecurity({
        authz: {
          requiredPrivileges: ['read', { anyRequired: ['write', 'admin'] }],
        },
        authc: {
          enabled: 'optional',
        },
      })
    ).not.toThrow();
  });

  it('should pass validation for valid route security with authz disabled', () => {
    expect(() =>
      validRouteSecurity({
        authz: {
          enabled: false,
          reason: 'Authorization is disabled',
        },
        authc: {
          enabled: true,
        },
      })
    ).not.toThrow();
  });

  it('should fail validation when authz is empty', () => {
    const routeSecurity = {
      authz: {},
      authc: {
        enabled: true,
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: expected value of type [array] but got [undefined]"`
    );
  });

  it('should fail when requiredPrivileges include an empty privilege set', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: [{}],
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).toThrowErrorMatchingInlineSnapshot(`
      "[authz.requiredPrivileges.0]: types that failed validation:
      - [authz.requiredPrivileges.0.0]: either anyRequired or allRequired must be specified
      - [authz.requiredPrivileges.0.1]: expected value of type [string] but got [Object]"
    `);
  });

  it('should fail validation when requiredPrivileges array is empty', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: [],
      },
      authc: {
        enabled: true,
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: array size is [0], but cannot be smaller than [1]"`
    );
  });

  it('should fail validation when anyRequired array is empty', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: [{ anyRequired: [] }],
      },
      authc: {
        enabled: true,
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).toThrowErrorMatchingInlineSnapshot(`
      "[authz.requiredPrivileges.0]: types that failed validation:
      - [authz.requiredPrivileges.0.0.anyRequired]: array size is [0], but cannot be smaller than [2]
      - [authz.requiredPrivileges.0.1]: expected value of type [string] but got [Object]"
    `);
  });

  it('should fail validation when anyRequired array is of size 1', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: [{ anyRequired: ['privilege-1'], allRequired: ['privilege-2'] }],
      },
      authc: {
        enabled: true,
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).toThrowErrorMatchingInlineSnapshot(`
      "[authz.requiredPrivileges.0]: types that failed validation:
      - [authz.requiredPrivileges.0.0.anyRequired]: array size is [1], but cannot be smaller than [2]
      - [authz.requiredPrivileges.0.1]: expected value of type [string] but got [Object]"
    `);
  });

  it('should fail validation when allRequired array is empty', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: [{ allRequired: [] }],
      },
      authc: {
        enabled: true,
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).toThrowErrorMatchingInlineSnapshot(`
      "[authz.requiredPrivileges.0]: types that failed validation:
      - [authz.requiredPrivileges.0.0.allRequired]: array size is [0], but cannot be smaller than [1]
      - [authz.requiredPrivileges.0.1]: expected value of type [string] but got [Object]"
    `);
  });

  it('should pass validation with valid privileges in both anyRequired and allRequired', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: [
          { anyRequired: ['privilege1', 'privilege2'], allRequired: ['privilege3', 'privilege4'] },
        ],
      },
      authc: {
        enabled: true,
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).not.toThrow();
  });

  it('should fail validation when authz is disabled but reason is missing', () => {
    expect(() =>
      validRouteSecurity({
        authz: {
          enabled: false,
        },
        authc: {
          enabled: true,
        },
      })
    ).toThrowErrorMatchingInlineSnapshot(
      `"[authz.reason]: expected value of type [string] but got [undefined]"`
    );
  });

  it('should fail validation when authc is disabled but reason is missing', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: ['read'],
      },
      authc: {
        enabled: false,
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authc.reason]: expected value of type [string] but got [undefined]"`
    );
  });

  it('should fail validation when authc is provided in multiple configs', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: ['read'],
      },
      authc: {
        enabled: false,
      },
    };

    expect(() =>
      validRouteSecurity(routeSecurity, { authRequired: false })
    ).toThrowErrorMatchingInlineSnapshot(
      `"Cannot specify both security.authc and options.authRequired"`
    );
  });

  it('should pass validation when authc is optional', () => {
    expect(() =>
      validRouteSecurity({
        authz: {
          requiredPrivileges: ['read'],
        },
        authc: {
          enabled: 'optional',
        },
      })
    ).not.toThrow();
  });

  it('should pass validation when authc is disabled', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: ['read'],
      },
      authc: {
        enabled: false,
        reason: 'Authentication is disabled',
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).not.toThrow();
  });

  it('should pass validation when operator privileges are combined with superuser', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: [ReservedPrivilegesSet.operator, ReservedPrivilegesSet.superuser],
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).not.toThrow();
  });

  it('should pass validation with anyOf defined', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: [
          {
            allRequired: [
              { anyOf: ['privilege1', 'privilege2'] },
              { anyOf: ['privilege3', 'privilege4'] },
            ],
          },
        ],
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).not.toThrow();
  });

  it('should pass validation with allOf defined', () => {
    const routeSecurity = {
      authz: {
        requiredPrivileges: [
          {
            anyRequired: [
              { allOf: ['privilege1', 'privilege2'] },
              { allOf: ['privilege3', 'privilege4'] },
            ],
          },
        ],
      },
    };

    expect(() => validRouteSecurity(routeSecurity)).not.toThrow();
  });

  it('should fail validation when anyRequired and allRequired have the same values', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [
          { anyRequired: ['privilege1', 'privilege2'], allRequired: ['privilege1'] },
        ],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: anyRequired and allRequired cannot have the same values: [privilege1]"`
    );
  });

  it('should fail validation when anyRequired and allRequired have the same values in multiple entries', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [
          { anyRequired: ['privilege1', 'privilege2'], allRequired: ['privilege4'] },
          { anyRequired: ['privilege3', 'privilege5'], allRequired: ['privilege2'] },
        ],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: anyRequired and allRequired cannot have the same values: [privilege2]"`
    );
  });

  it('should fail validation when anyRequired has duplicate entries', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [
          { anyRequired: ['privilege1', 'privilege1'], allRequired: ['privilege4'] },
        ],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: anyRequired privileges must contain unique values"`
    );
  });

  it('should fail validation when allRequired has duplicate entries', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [
          { anyRequired: ['privilege4', 'privilege5'], allRequired: ['privilege1', 'privilege1'] },
        ],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: allRequired privileges must contain unique values"`
    );
  });

  it('should fail validation when anyRequired has duplicates in multiple privilege entries', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [
          { anyRequired: ['privilege1', 'privilege1'], allRequired: ['privilege4'] },
          { anyRequired: ['privilege1', 'privilege1'] },
        ],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: anyRequired privileges must contain unique values"`
    );
  });

  it('should fail validation when anyRequired has superuser privileges set', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [
          { anyRequired: ['privilege1', 'privilege1'], allRequired: ['privilege4'] },
          { anyRequired: ['privilege5', ReservedPrivilegesSet.superuser] },
        ],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: Using superuser privileges in anyRequired is not allowed"`
    );
  });

  it('should fail validation when allRequired combines superuser privileges set with other privileges', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [ReservedPrivilegesSet.superuser, 'privilege1'],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: Combining superuser with other privileges is redundant, superuser privileges set can be only used as a standalone privilege."`
    );
  });

  it('should fail validation when anyRequired has operator privileges set', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [
          { anyRequired: ['privilege1', 'privilege2'], allRequired: ['privilege4'] },
          { anyRequired: ['privilege5', ReservedPrivilegesSet.operator] },
        ],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: Using operator privileges in anyRequired is not allowed"`
    );
  });

  it('should fail validation when operator privileges set is used as standalone', () => {
    expect(() =>
      validRouteSecurity({
        authz: {
          requiredPrivileges: [{ allRequired: [ReservedPrivilegesSet.operator] }],
        },
      })
    ).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: Operator privilege requires at least one additional non-operator privilege to be defined"`
    );

    expect(() =>
      validRouteSecurity({
        authz: {
          requiredPrivileges: [ReservedPrivilegesSet.operator],
        },
      })
    ).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: Operator privilege requires at least one additional non-operator privilege to be defined"`
    );
  });

  it('should fail validation when anyOf does not satisfy minSize', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [{ allRequired: [{ anyOf: ['privilege1'] }] }],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(`
      "[authz.requiredPrivileges.0]: types that failed validation:
      - [authz.requiredPrivileges.0.0.allRequired.0]: types that failed validation:
       - [authz.requiredPrivileges.0.allRequired.0.0]: expected value of type [string] but got [Object]
       - [authz.requiredPrivileges.0.allRequired.0.1.anyOf]: array size is [1], but cannot be smaller than [2]
      - [authz.requiredPrivileges.0.1]: expected value of type [string] but got [Object]"
    `);
  });

  it('should fail validation when allOf does not satisfy minSize', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [{ anyRequired: [{ allOf: ['privilege1'] }, 'privilege2'] }],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(`
      "[authz.requiredPrivileges.0]: types that failed validation:
      - [authz.requiredPrivileges.0.0.anyRequired.0]: types that failed validation:
       - [authz.requiredPrivileges.0.anyRequired.0.0]: expected value of type [string] but got [Object]
       - [authz.requiredPrivileges.0.anyRequired.0.1.allOf]: array size is [1], but cannot be smaller than [2]
      - [authz.requiredPrivileges.0.1]: expected value of type [string] but got [Object]"
    `);
  });

  it('should fail validation when anyOf has duplicated privileges', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [
          {
            allRequired: [
              { anyOf: ['privilege1', 'privilege2'] },
              { anyOf: ['privilege3', 'privilege1'] },
            ],
          },
        ],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: allRequired privileges must contain unique values"`
    );
  });

  it('should fail validation when allOf has duplicated privileges', () => {
    const invalidRouteSecurity = {
      authz: {
        requiredPrivileges: [
          {
            anyRequired: [
              { allOf: ['privilege1', 'privilege2'] },
              { allOf: ['privilege3', 'privilege1'] },
            ],
          },
        ],
      },
    };

    expect(() => validRouteSecurity(invalidRouteSecurity)).toThrowErrorMatchingInlineSnapshot(
      `"[authz.requiredPrivileges]: anyRequired privileges must contain unique values"`
    );
  });
});

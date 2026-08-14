/* ============================================================
   Coach API — output validation
   ------------------------------------------------------------
   A small validator for the subset of JSON Schema that schemas.js
   actually uses: type, properties, required, additionalProperties,
   items and enum. Nothing else is supported, deliberately — this is
   not a general validator and should not grow into one.

   Why this exists at all: with Claude, output_config.format
   *constrains* generation, so the response cannot be off-schema and
   validating it would be dead code. OpenRouter routes to many models
   and not all of them honour response_format — some ignore it, some
   emit the schema itself, some wrap the object in prose. So on that
   path the schema stops being a guarantee and becomes a request.

   That matters more here than in a typical app. The schema is one of
   the three places the evidence contract is enforced: every finding
   must carry an `evidenceType` of known/observed/inferred. A model
   that quietly drops that field, or invents a fourth value, would
   produce findings the UI renders without the "inferred, not
   confirmed" chip — which is exactly the overclaiming the contract
   exists to prevent. Validating after the fact restores the
   guarantee no matter which model answered.
   ============================================================ */
'use strict';

const MAX_ERRORS = 12;   // enough to repair from, short enough to send back

function typeOk(value, type) {
    switch (type) {
        case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
        case 'array': return Array.isArray(value);
        case 'string': return typeof value === 'string';
        case 'boolean': return typeof value === 'boolean';
        case 'number': return typeof value === 'number' && isFinite(value);
        // JSON has no integer type; accept a whole number. Models routinely
        // emit 5.0 where 5 was asked for, and rejecting that is pedantry.
        case 'integer': return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
        default: return true;
    }
}

/**
 * @returns {string[]} human-readable problems, empty when valid.
 *   Messages are written to be fed straight back to the model as a
 *   repair instruction, so they name the path and what was expected.
 */
function validate(value, schema, path = 'root', errors = []) {
    if (errors.length >= MAX_ERRORS) return errors;
    if (!schema || typeof schema !== 'object') return errors;

    if (schema.type && !typeOk(value, schema.type)) {
        errors.push(`${path}: expected ${schema.type}, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`);
        // The type is wrong, so descending would only produce noise.
        return errors;
    }

    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
        errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
        return errors;
    }

    if (schema.type === 'object' && typeOk(value, 'object')) {
        for (const key of (schema.required || [])) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) {
                errors.push(`${path}.${key}: required field is missing`);
            }
        }
        if (schema.additionalProperties === false && schema.properties) {
            for (const key of Object.keys(value)) {
                if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) {
                    errors.push(`${path}.${key}: unexpected field`);
                }
            }
        }
        for (const [key, sub] of Object.entries(schema.properties || {})) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                validate(value[key], sub, `${path}.${key}`, errors);
            }
        }
    }

    if (schema.type === 'array' && Array.isArray(value) && schema.items) {
        for (let i = 0; i < value.length; i++) {
            validate(value[i], schema.items, `${path}[${i}]`, errors);
            if (errors.length >= MAX_ERRORS) break;
        }
    }

    return errors;
}

/**
 * Strips fields the schema does not allow, recursively.
 *
 * Used only on the json_object fallback path. An extra field is the one
 * failure worth fixing silently: it means the model was more helpful
 * than asked, not that it invented a finding. A *missing* field is never
 * repaired here — that goes back to the model, because filling it in
 * ourselves would be us writing the coaching content.
 */
function prune(value, schema) {
    if (!schema || typeof schema !== 'object') return value;

    if (schema.type === 'object' && typeOk(value, 'object') && schema.properties) {
        const out = {};
        for (const [key, sub] of Object.entries(schema.properties)) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                out[key] = prune(value[key], sub);
            }
        }
        return out;
    }
    if (schema.type === 'array' && Array.isArray(value) && schema.items) {
        return value.map(v => prune(v, schema.items));
    }
    return value;
}

module.exports = { validate, prune, MAX_ERRORS };

# Phase 5: authenticated applicant pages

Baseline: `dff90cf5eac1044cde8f8e908466f661192aefc9`.

Authenticated server pages for the applicant list, complete authorized filters/counts/facets, explicit full selection for quick review and voting. Existing canonical privacy projection remains authoritative. No database/schema/infrastructure/security changes.

Page responses and browser work are bounded to 100 rows; privacy-aware filtering/sorting still scans the authorized summary set on the server. This phase does not claim bounded SQL cost.

Four frozen build blocks (BA then AB) per 100/1,000/5,000 cohort; one warmup and five measured outcomes per navigation/temperature/build/block. All planned failures remain in the denominator. Temporary local sleep inhibition is checked against the power log.

Complete-selection and pagination browser acceptance is additional to the established initial-navigation harness. No deployment or production configuration changes.

Before collection: add warm next-page and distant-search comparisons for 1,000 and 5,000 applicants in the same BA/AB blocks. Each block has one warmup and five measured outcomes per interaction. These expose extra round trips versus the former resident whole-list implementation. No benchmark requests are intercepted.

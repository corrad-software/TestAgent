import { SYSTEM_PROMPT } from "./prompts";

export type TestType = "smoke" | "navigation" | "forms" | "responsive" | "accessibility" | "quick";

export interface SuiteConfig {
  goal: string;
  systemPrompt: string;
  maxIterations: number;
  toolSubset?: string[];
}

export function getSuiteConfig(testType: TestType, url: string, description?: string): SuiteConfig {
  switch (testType) {
    case "smoke":
      return {
        goal: `Perform a smoke test on: ${url}

Steps:
1. Navigate to ${url}
2. Call get_page_content to inspect the page state
3. Execute JS to check for console errors: execute_js with script "typeof window.__errors !== 'undefined' ? window.__errors : []"
4. Take a screenshot named "smoke-final"
5. Assert the page title is not empty
6. Try clicking the first visible navigation link (if any) and verify the page responds
7. Navigate back to ${url}

${description ? `Additional checks: ${description}\n` : ""}Report PASS if the page loads and shows content without critical errors.
Report FAIL with specific reasons if the page fails to load, shows errors, or is empty.`,
        systemPrompt:
          SYSTEM_PROMPT +
          "\nYou are performing a smoke test. Your goal is to verify the page loads correctly and core content is present. Always take a screenshot at the end. Be concise.",
        maxIterations: 15,
      };

    case "navigation":
      return {
        goal: `Test the navigation of: ${url}

Steps:
1. Navigate to ${url}
2. Use execute_js to extract all internal links:
   script: "Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => h.startsWith(window.location.origin)).slice(0, 15)"
3. For each link (up to 10): navigate to it, call get_page_content to check it loaded
4. Take a screenshot of any page that fails to load or shows an error
5. Navigate back to ${url} when done

${description ? `Additional context: ${description}\n` : ""}Report PASS if all visited links load successfully.
Report FAIL listing any broken links or error pages found.`,
        systemPrompt:
          SYSTEM_PROMPT +
          "\nYou are testing navigation. Extract links with execute_js, then visit each one (up to 10 same-domain links). Flag any that return errors or fail to load.",
        maxIterations: 20,
      };

    case "forms":
      return {
        goal: `Test forms on: ${url}

Steps:
1. Navigate to ${url}
2. Use execute_js to find all forms and their fields:
   script: "Array.from(document.querySelectorAll('form')).map(f => ({ id: f.id, action: f.action, fields: Array.from(f.querySelectorAll('input,textarea,select')).map(el => ({ type: el.type, name: el.name, id: el.id, placeholder: el.placeholder, label: document.querySelector('label[for=\\"' + el.id + '\\"]')?.textContent?.trim() || '' })) }))"
3. For each form found: infer appropriate test data based on field types and labels (email fields → test@example.com, password fields → TestPass123!, name fields → Test User, phone fields → +1234567890, text areas → "This is a test message")
4. Use fill_form to fill the fields, then click the submit button
5. Observe the response (success message, error, redirect)
6. Take a screenshot after submission

${description ? `Additional context: ${description}\n` : ""}Report PASS if forms accept input and submit without critical errors.
Report FAIL if forms are broken, submit without validation, or show unexpected errors.`,
        systemPrompt:
          SYSTEM_PROMPT +
          "\nYou are testing forms. Read field labels carefully and use appropriate dummy data. Do not use real personal information. After submitting, check for success messages or validation errors.",
        maxIterations: 20,
      };

    case "responsive":
      return {
        goal: `Test responsive design of: ${url}

Test at three viewport sizes in sequence:

1. Mobile (375x812):
   - set_viewport width=375 height=812
   - Navigate to ${url}
   - get_page_content to see the page state
   - execute_js script: "document.documentElement.scrollWidth > document.documentElement.clientWidth" (check horizontal overflow)
   - screenshot name="mobile-375"

2. Tablet (768x1024):
   - set_viewport width=768 height=1024
   - Navigate to ${url}
   - execute_js same overflow check
   - screenshot name="tablet-768"

3. Desktop (1280x800):
   - set_viewport width=1280 height=800
   - Navigate to ${url}
   - execute_js same overflow check
   - screenshot name="desktop-1280"

${description ? `Additional checks: ${description}\n` : ""}Report PASS if the page renders without layout issues at all three sizes.
Report FAIL with which breakpoints have problems and what the issues are.`,
        systemPrompt:
          SYSTEM_PROMPT +
          "\nYou are doing responsive design testing. Test at three viewport sizes. At each size, take a screenshot and check for layout issues like horizontal overflow.",
        maxIterations: 18,
      };

    case "accessibility":
      return {
        goal: `Perform an accessibility audit of: ${url}

Steps:
1. Navigate to ${url}
2. Run check_accessibility (this uses axe-core to detect WCAG violations)
3. Use execute_js to verify heading hierarchy:
   script: "Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => ({ level: h.tagName, text: h.textContent?.trim().slice(0,50) }))"
4. Use execute_js to check images for alt text:
   script: "Array.from(document.querySelectorAll('img')).map(img => ({ src: img.src.split('/').pop(), hasAlt: img.hasAttribute('alt'), altText: img.alt }))"
5. Use execute_js to check form inputs for labels:
   script: "Array.from(document.querySelectorAll('input,textarea,select')).map(el => ({ type: el.type, name: el.name, hasLabel: !!document.querySelector('label[for=\\"'+el.id+'\\"]') || !!el.closest('label'), ariaLabel: el.getAttribute('aria-label') || '' }))"
6. Take a screenshot

${description ? `Additional focus: ${description}\n` : ""}Explain each violation found in plain English. Rate overall accessibility as Good / Needs Improvement / Poor with justification.
Report PASS if no critical or serious violations. Report FAIL if critical violations exist.`,
        systemPrompt:
          SYSTEM_PROMPT +
          "\nYou are an accessibility expert. After running check_accessibility, explain each violation in plain English. Also manually verify heading hierarchy, alt text, and form labels. Rate overall accessibility as: Good (0-2 minor issues), Needs Improvement (3-5 issues or any serious ones), or Poor (critical issues present).",
        maxIterations: 15,
      };

    case "quick":
      return {
        goal: "",
        systemPrompt: SYSTEM_PROMPT,
        maxIterations: 0,
      };
  }
}

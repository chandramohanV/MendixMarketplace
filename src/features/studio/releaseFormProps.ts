/** id, ARIA wiring and blur tracking for a release-form control (ids are `rf-<error key>`). */
export interface ReleaseControlProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  onBlur: () => void;
}

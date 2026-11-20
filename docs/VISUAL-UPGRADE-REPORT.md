# Visual Upgrade Report — CICS Photos

The approved CICS facility photographs are already stored in the repository under
`client/public/assets/images/facilities/`, organized into `1st Floor` through
`5th Floor` and `Building` folders. The implementation maps canonical facility
codes directly to these existing source files, preserving their exact filenames,
extensions, and folder structure.

The implementation adds canonical photo mappings for the 35 confirmed matches,
uses the existing `Building/Wider.jpeg` exterior photo as the preferred landing
hero, and displays facility images in the standalone public homepage preview.
The existing React directory and detail views already use the facility image URL
from the API, so the API resolves the canonical photo mappings there as well.

Three photos remain deliberately unassigned because they do not match a confirmed
canonical catalog entry. The 2nd-floor Male Toilet and 4th-floor Tech Laboratory
retain fallback imagery because no exact photo match is available.

A separate optimized WebP copy pack was prepared, but it is not required by this
implementation and is not referenced by the current paths. If adopted later, the
WebP files should replace their corresponding files within the same floor folders;
do not flatten the asset structure. No production data or deployment was changed.

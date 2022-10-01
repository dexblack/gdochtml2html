# gdochtml2html
Exported Google doc as zipped HTML conversion to raw HTML.

	Usage: gdochtml2html convert zipFilePath

	Output: dir\zipBaseName.html

	The output is NOT conformant HTML5 or even 1.
	It is raw HTML tags intended for copying and pasting directly into a Drupal raw HTML editor.
	All the HTML wrapping, styling etc., will be done by Drupal.

	Note: Google download Doc as Zipped HTML has some quirks that needed ironing.
	1. The file name in the zip has all the spaces removed.
	2. The style content is large and simply needs to be removed prior to processing internally.
	3. If the style names or output format ever change, this program will fail.
	4. ol tags are not nested inside li tags as one would have hoped.
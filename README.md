WEBFLOW CMS SYNCHRONIZER
-------------------------------------------------------------------

Inspiration / Purpose:
    This program is designed to help maintain multiple Webflow websites which may have some degree of overlapping content.  For example, perhaps your company has 2 websites, one for each country in which you operate.  You want to have separate sites so that you can easily upload country-specific content and target the wording and design of certain pages to those countries.  You will have some "pages" on one site and not the other (and perhaps vice versa) or have site-specific CMS content, such as "event listings" that describe events taking place in one country but not the other.  Yet at the same time, there is an abundance of content--e.g. blogs, articles, and videos--that you want shared across both sites.  With this tool, making that vision a reality is quick and easy.  The Webflow CMS Synchronizer will help you keep core global content consistent across websites, while allowing you to maintain unique site-specific content as well.  The choice is yours -- You are free to determine which content is transferred over and which content stays in one place.  However, if you wish to transfer ALL content automatically when the program is run, there is an option to do so (see below).  A second potential use is for permanently migrating content from a defunct old website to its replacement site.

Overview:
    The Webflow CMS Synchronizer, broadly speaking, consists of three steps.
        1) Retrieving data from Webflow's servers.  This step takes by far the longest; this is intentional and necessary in order to avoid Webflow's rate limit.
        2) Auditing site data to ensure collection fields and schema are consistent.  Inconsistent fields across sites makes transferring items impossible, and thus in order to avoid errors, the program will ignore inconsistent collections and report them to the user in the errors.txt file.
        3) Transferring items.  On this step, you will be prompted (if "addItemsAutomatically" is set to "false" -- see below) for each item that is present in the "main" site but not in some secondary site, given that the item belongs to a CMS collection that is consistent in both sites -- in other words, the collection has exactly the same fields in both sites, and the fields have the same attributes / properties.

Settings:
    The program settings are contained in a file named "configure.json".  This is where site data--i.e. names and API tokens--is stored.  If you wish to add an additional site, you will need to make sure that configure.json reflects any changes.  Likewise, if you wish to remove a site, you can simply remove the corresponding site object from config.json.  Moreover, this file allows you to change the program's operational settings.  At the moment there is only one--"addItemsAutomatically."  When this is switched to "true", the CMS synchronizer will automatically transfer ALL CMS items from the main site (defined as the first site listed in config.json) to ALL secondary sites (defined as all other sites).  If "addItemsAutomatically" is set to "false", then you will be prompted when the program runs for each item that it proposes adding.

Images:
    Webflow has not yet implemented the images endpoint into its API.  Consequently, there is not any way to upload images (or any other type of asset) to Webflow programmatically.  This can be problematic if you are transferring CMS content that features images.  Because those images are stored as image-IDs that are unique to each site and reference site-specific assets, it isn't possible to simply transfer images over.  Unfortunately, you will need to manually upload images to the site where content is being moved to, and insert them into the relevant collection items / fields.  In order to automate this process as much as possible, the CMS Synchronizer program will automatically download all images you need into a folder fittingly named "Images."  That directory is structured as follows: "Images" -> [Site name] -> [Collection name] -> [Collection item] -> [Field name].jpg/.png

Other notes:
    -- Included is a Windows batch (.bat) file named "Run Webflow Sync."  For ease of use, it is highly recommended that you create a desktop shortcut to this file if you plan on making use of this program regularly.  Double-clicking the "Run Webflow Sync" batch file will automatically open a terminal window - press any key, and the program is off! 

Bugs / errors:
    Feel free to contact me at leavitts@wharton.upenn.edu with any errors or bugs in the program.  I will do my best to help you resolve any issues.


-------------------------------------------------------------------

Copyright (c) 2017 Sam Leavitt <leavitts@wharton.upenn.edu>

Permission to use, copy, modify, and distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

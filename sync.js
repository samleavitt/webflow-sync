const Webflow = require('webflow-api');
const Promise = require('bluebird');
const fs = require('fs');
const sprintf = require('sprintf-js').sprintf;
const _ = require('lodash');
const query = require('cli-interact').getYesNo;
const ProgressBar = require('progress');
const chalk = require('chalk');
const request = require('request');

// Format warnings output to terminal
warning = str => chalk.redBright(str);

// Format loading bar
const loadingBarComplete = chalk.bgBlue(' ');
const loadingBarIncomplete = chalk.bgWhite(' ');
const barLength = 30;

// Create separator (in terminal) from any previous executions
console.log('\n' + chalk.green('=').repeat(100));
console.log(chalk.green('=').repeat(30) +
	chalk.cyan(" Beginning Webflow CMS Synchronization ") +
	chalk.green('=').repeat(31));
console.log(chalk.green('=').repeat(100) + '\n');

// Create file to log errors
const filename = 'errors.txt'
const changelog = 'changelog.txt';

fs.openSync(filename, 'a');
fs.openSync(changelog, 'a');

// Clear file of old contents
fs.truncate(filename, 0);

// String to hold accumulated error messages
var log = "";

// String to store log of items added
var additions = "";

// Total errors counter
var errorCount = 0;

// Log current date and time
var dateStr = "";
var star = "*";
var horiz = "-";
var vert = "|";
var space = " ";
var date = new Date();
var topBottom = vert.repeat(2) + horiz.repeat(6 + String(date).length) +
				vert.repeat(2) + "\n";
var leftRight = vert.repeat(2) + space.repeat(6 + String(date).length) +
				vert.repeat(2) + "\n";
dateStr += (topBottom + leftRight + vert.repeat(2) +
			space.repeat(3) + date + space.repeat(3) + vert.repeat(2) +
			"\n" + leftRight + topBottom + "\n");

/* ****************************************************** */

// New array to hold webflow objects
var webflowObjects = new Array();

// New array to hold website string descriptions
var siteNames = new Array();

// New array to hold site IDs
var siteIDs = new Array();

// New 2D array to store collections corresponding to each site
var siteCollections = new Array();

// 2D arrays to hold schema for main and secondary sites, respectively
var a_Schema = new Array();
var b_Schema = new Array();

// Index 0 is not used (for the sake of simplicity and readibility)
a_Schema.push(null);
b_Schema.push(null);

// 2D arrays to hold items for main and secondary sites, respectively
var a_Items = new Array();
var b_Items = new Array();

// Index 0 is not used (for the sake of simplicity and readibility)
a_Items.push(null);
b_Items.push(null);


// New 2D array to store which collections are error-free
var errorFreeCollections = new Array();

// Index 0 is not used (for the sake of simplicity and readibility);
errorFreeCollections.push(null);

/* Number of total collections that must be processed;
 * (Useful in determining bounds for looped operations)
 * (Note: this gets initialized after collections data is gathered. 
 * DO NOT use it before then!) */
var totalSharedCollections = 0;

/* Create new array to store data of shared collections common to main site
 * and corresponding supplementary site
 * Usage example: sharedData[5] would store data regarding collections that are
 * common to both the main site and to the supplementary site with index 5.
 * sharedData[0] is arbitrarily set to null and should never be used */
sharedData = new Array();
sharedData.push(null);

/* The following is used as a mapping from a site A collectionID to the
 * corresponding collection object.  This is used to streamline and hasten
 * the collection retrieval step of the program. The same collection should
 * never need to be retrieved from the server more than one time. */
a_SiteCollections = new Map();

/* Analogous purpose to Map above */
a_SiteItems = new Map();

/* Array to store all site A collection IDs... useful for gathering all site A
 * collections and items without having to access a "sharedData" object.
 * Allows us to retrieve all site A data once and then reconfigure the data.
 * More time efficient... */
var a_Site_IDs = new Array();

/* ****************************************************** */

// Load in settings data from config.json file
var settings = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

// Import site data (names and tokens) from config.json
const numSites = settings.sites.length
for (var i = 0; i < numSites; i++) {
	siteNames.push(settings.sites[i].siteName);
	webflowObjects.push(new Webflow({token: settings.sites[i].token }));
}

/* ****************************************************** */

function getSite (webflow, siteIDs, rateLimitHit) {
	return new Promise(function(resolve, reject) {
		const sites = webflow.sites();
		sites.then(s => {
			rateLimitHit = false;
			var siteObj = JSON.parse(JSON.stringify(s[0]));
			var siteID = siteObj._id;
			siteIDs.push(siteID);
			resolve(siteID);
		}).catch(err => {
			var msg = JSON.parse(JSON.stringify(err)).msg;
			console.log('\n' + chalk.redBright(msg));
			if (msg == "Rate limit hit") {
				rateLimitHit = true;
			}
		});
	});
}

function getCollections (webflow, id, siteIndex, collectionArray) {
	return new Promise(function(resolve, reject) {
		const collections = webflow.collections({ siteId: id });
		collections.then(c => {
			rateLimitHit = false;
			for (var i = 0; i < c.length; i++) {
				var collObj = JSON.parse(JSON.stringify(c[i]));
				collectionArray.push(collObj);
				resolve(collObj);
			}
		}).catch(err => {
			var msg = JSON.parse(JSON.stringify(err)).msg;
			console.log('\n' + chalk.redBright(msg));
			if (msg == "Rate limit hit") {
				rateLimitHit = true;
			}
		});
	});
}

var bar = new ProgressBar('Retrieving site metadata :bar :percent :etas remaining', {
	complete: loadingBarComplete,
	incomplete: loadingBarIncomplete,
	total: numSites * 6
});


var count = {val: 0};
var collectionPromises = promiseWhile(function() {
	return count.val < numSites;
}, function() {
	var index = count.val;
	count.val++;
	bar.tick(6);
	siteCollections[index] = new Array();
	return getSite(webflowObjects[index], siteIDs).then(siteID =>
		getCollections(webflowObjects[index], siteID, index, siteCollections[index]));
});


function getCommonCollectionsData(a_Collections, b_Collections, a_Site, b_Site) {
	// Create copy of b_Site names, to track collections on site B but not site A
	var b_Copy = new Array();
	for (var i = 0; i < b_Collections.length; i++) {
		b_Copy.push(b_Collections[i].slug);
	}

	// Iterate through site A collections, and note any absences from site B.
	var collectionsMatch = true;
	var a_Missing = false;
	var b_Missing = false;

	var sharedNames = new Array();
	var sharedSlugs = new Array();
	var a_CollectionIDs = new Array();
	var b_CollectionIDs = new Array();

	for (var i = 0; i < a_Collections.length; i++) {
		var a_Slug = a_Collections[i].slug;
		var nameFound = false;
		for (var j = 0; j < b_Collections.length; j++) {
			var b_Slug = b_Collections[j].slug;
			if (b_Slug == a_Slug) {
				var index = b_Copy.indexOf(a_Slug);
				var value = b_Copy.splice(index, 1);
				// Push shared collection slug and name to appropriate arrays
				sharedNames.push(a_Collections[i].name)
				sharedSlugs.push(a_Collections[i].slug);
				a_CollectionIDs.push(a_Collections[i]._id);
				b_CollectionIDs.push(b_Collections[j]._id);
				nameFound = true;
				break;
			}
		}
		if (!nameFound) {
			log += sprintf('WARNING: %s contians collection "%s" but %s does not!\n',
				a_Site, a_Collections[i].name, b_Site);
			collectionsMatch = false;
			b_Missing = true;
			errorCount++;
		}
	}
	for (var i = 0; i < b_Copy.length; i++) {
		log += sprintf('WARNING: %s contains collections %s but %s does not!\n',
			b_Site, b_Copy[i], a_Site);
		collectionsMatch = false;
		a_Missing = true;
		errorCount++;
	}

	// Print separator if site just processed is the last one
	if (b_Site == siteNames[numSites - 1]) {
		log += star.repeat(75) + '\n';
	}


	if (a_Missing) {
		console.log(warning('WARNING:') +
			' %s is missing collections.  See errors.txt for full details.', a_Site);
	}
	if (b_Missing) {
		console.log(warning('WARNING:') +
			' %s is missing collections.  See errors.txt for full details.', b_Site);
	}
	var data = {
		names: sharedNames,
		slugs: sharedSlugs,
		a_IDs: a_CollectionIDs,
		b_IDs: b_CollectionIDs
	}
	return data;
}

collectionPromises.then(function() {

	for (var i = 1; i < numSites; i++) {
		sharedData.push(getCommonCollectionsData(siteCollections[0], siteCollections[i],
			siteNames[0], siteNames[i]));
	}

/* ********************************************************************************************** */
/* ********************************************************************************************** */

	for (var i = 1; i < numSites; i++) {
		totalSharedCollections += sharedData[i].slugs.length;
	}

	function getCollections (site, siteIDs, siteSchema, siteName, counter) {
		return new Promise(function(resolve, reject) {
			const collection = site.collection({ collectionId: siteIDs[counter.val]} );
			collection.then(c => {
				var collObj = JSON.parse(JSON.stringify(c));

				// Add collection object to map if site is a_Site
				if (site == webflowObjects[0]) {
					a_SiteCollections.set(siteIDs[counter.val], collObj);
				}

				// Slow down program if rate limit is being approached
				if (collObj._meta.rateLimit.remaining < 10) {
					var waitTime = (collObj._meta.rateLimit.limit * 500) / collObj._meta.rateLimit.remaining;
					printWaitTime(siteName, collObj._meta.rateLimit.remaining);
					setTimeout(() => {
						siteSchema.push(collObj);
						counter.val++;
						resolve();
					}, waitTime);
				} else {
					siteSchema.push(collObj);
					counter.val++;
					resolve();
				}
			});
		});
	}

	// Make room for "waiting" message
	process.stdout.write("\n");
	process.stdout.write("\n");

	var bar2 = new ProgressBar('Retrieving collection attributes :bar :percent :etas remaining', {
		complete: loadingBarComplete,
		incomplete: loadingBarIncomplete,
		total: totalSharedCollections + siteCollections[0].length
	});

	function getCollectionPromises(webflowObject, collectionIDs, singleSiteSchema, siteName) {
		var count = {val: 0}
		var collPromises = promiseWhile(function() {
			return count.val < collectionIDs.length;
		}, function() {
			bar2.tick();
			return getCollections(webflowObject, collectionIDs, singleSiteSchema, siteName, count);
		});
		return collPromises;
	}

	var siteCollectionPromises = new Array();

	// Get a_Site IDs in an array (convert object array to string array)
	for (var i = 0; i < siteCollections[0].length; i++) {
		a_Site_IDs.push(siteCollections[0][i]._id);
	}

	// Get site A collection data for the MAP
	// We don't care about singleSiteSchema for now, since we'll revisit it later.
	// So just use an array that gets discarded
	siteCollectionPromises.push(getCollectionPromises(
		webflowObjects[0], a_Site_IDs, new Array(), siteNames[0]));

	for (var i = 1; i < numSites; i++) {
		// var a_singleSiteSchema = new Array();
		var b_singleSiteSchema = new Array();
		// a_Schema.push(a_singleSiteSchema);
		b_Schema.push(b_singleSiteSchema);
		// siteCollectionPromises.push(getCollectionPromises(
		// 	webflowObjects[0], sharedData[i].a_IDs, a_singleSiteSchema, siteNames[0]));

		siteCollectionPromises.push(getCollectionPromises(
			webflowObjects[i], sharedData[i].b_IDs, b_singleSiteSchema, siteNames[i]));
	}
	return Promise.all(siteCollectionPromises);

}).then(function() {

	// Add A site data to proper data structures
	for (var i = 1; i < numSites; i++) {
		var a_singleSiteSchema = new Array();
		a_Schema.push(a_singleSiteSchema);

		for (var j = 0; j < sharedData[i].a_IDs.length; j++) {
			var collObj = a_SiteCollections.get(sharedData[i].a_IDs[j]);
			a_singleSiteSchema.push(collObj);
		}
	}

	console.log("Gathered all website collection data");
	
	for (var i = 1; i < numSites; i++) {
		var errorFreeCollectionsEntry = checkCollectionAttributes(a_Schema[i], b_Schema[i],
			siteNames[0], siteNames[i], sharedData[i]);
		errorFreeCollections.push(errorFreeCollectionsEntry);
	}

	/* Check which pairs of sites have errors that need to be checked.
	 * Output notice to user that they should check errors.txt for details
	 * and that items cannot be added if there are errors in the underlying
	 * collection attributes */
	for (var i = 1; i < errorFreeCollections.length; i++) {
		var perfect = true;
		for (var j = 0; j < errorFreeCollections[i].length; j++) {
			if (errorFreeCollections[i][j] == false) {
				perfect = false;
			}
		}
		if (!perfect) {
			console.log(warning('WARNING:') + ' Collection attributes do not match between %s and %s.\n' +
				'See error.txt for full details', siteNames[0], siteNames[i]);
		}
	}

	/* Next, gather all items from all sites, only for collections that are
	 * without errors */

	function getItems (site, siteIDs, errorFreeArray, siteItems, siteName, counter) {
		return new Promise(function(resolve, reject) {
			if (errorFreeArray[counter.val]) {
				const item = site.items({ collectionId: siteIDs[counter.val]} );
				item.then(data => {
					var itemObj = JSON.parse(JSON.stringify(data));

					var totalBatchPromises = new Array();						n

					/* If total collection size is greater than the maximum
					 * that can be retrieved at one time, iteratively fetch
					 * chunks of the data and merge them into one large array */

					if (itemObj.total > itemObj.count) {
						var total = itemObj.total;
						var curr = itemObj.count;
						var limit = itemObj.limit;
						var itemsArray = itemObj.items;

						while (curr < total) {
							var thisBatchPromise = new Promise(function(resolve, reject) {
								var newItem = site.items({ collectionId: siteIDs[counter.val]},
									{offset: curr});
								newItem.then(data => {
									itemObj.items = itemObj.items.concat(JSON.parse(JSON.stringify(data)).items);
									resolve();
								});
							});
							totalBatchPromises.push(thisBatchPromise);
							curr += limit;
						}
					}

					Promise.all(totalBatchPromises).then(function() {
						// Add item to map if site is site A
						if (site == webflowObjects[0]) {
							a_SiteItems.set(siteIDs[counter.val], itemObj);
						}

						// Slow down program if rate limit is being approached
						if (itemObj._meta.rateLimit.remaining < 10) {
							var waitTime = (itemObj._meta.rateLimit.limit * 500) / itemObj._meta.rateLimit.remaining;
							printWaitTime(siteName, itemObj._meta.rateLimit.remaining);
							setTimeout(() => {
								siteItems.push(itemObj);
								counter.val++;
								resolve(itemObj);
							}, waitTime);
						} else {
							siteItems.push(itemObj);
							counter.val++;
							resolve(itemObj);
						}
					});
				});
			} else {
				// push null element if corresponding collection had errors
				siteItems.push(null);
				counter.val++;
				resolve();
			}
		});
	}

	// Make room for "waiting" message
	process.stdout.write("\n");
	process.stdout.write("\n");

	var bar3 = new ProgressBar('Retrieving Webflow CMS items :bar :percent :etas remaining', {
		complete: loadingBarComplete,
		incomplete: loadingBarIncomplete,
		total: totalSharedCollections + siteCollections[0].length
	});


	function getItemPromises(webflowObject, collectionIDs, errorFreeArray, singleSiteItems, siteName) {
		var count = {val: 0}
		var itemPromises = promiseWhile(function() {
			return count.val < collectionIDs.length;
		}, function() {
			bar3.tick();
			return getItems(webflowObject, collectionIDs, errorFreeArray, singleSiteItems, siteName, count);
		});
		return itemPromises;
	}

	var siteItemPromises = new Array();

	// Initialize array of all true, to get all site A items (see immediately below)
	allTrue = new Array();
	for (var i = 0; i < a_Site_IDs.length; i++) {
		allTrue.push(true);
	}

	// Get site A items data for all collections
	siteItemPromises.push(getItemPromises(
		webflowObjects[0], a_Site_IDs, allTrue, new Array(), siteNames[0]));

	for (var i = 1; i < numSites; i++) {
		// var a_singleSiteItems = new Array();
		var b_singleSiteItems = new Array();
		// a_Items.push(a_singleSiteItems);
		b_Items.push(b_singleSiteItems);
		// siteItemPromises.push(getItemPromises(
		// 	webflowObjects[0], sharedData[i].a_IDs, errorFreeCollections[i], a_singleSiteItems, siteNames[0]));
		siteItemPromises.push(getItemPromises(
			webflowObjects[i], sharedData[i].b_IDs, errorFreeCollections[i], b_singleSiteItems, siteNames[i]));
	}
	return Promise.all(siteItemPromises);

}).then(function() {

	// Add A site items to proper data structures
	for (var i = 1; i < numSites; i++) {
		var a_singleSiteItems = new Array();
		a_Items.push(a_singleSiteItems);

		for (var j = 0; j < sharedData[i].a_IDs.length; j++) {
			if (errorFreeCollections[i][j]) {
				var itemObj = a_SiteItems.get(sharedData[i].a_IDs[j]);
				a_singleSiteItems.push(itemObj);
			} else {
				// push null element if corresponding collection had errors
				a_singleSiteItems.push(null);
			}
		}
	}


	console.log("Gathered all website items data\n");

	for (var i = 0; i < sharedData[2].a_IDs.length; i++) {
		if (a_Items[2][i] == null) {
			console.log(null)
		} else {
			console.log(a_Items[2][i].items.length);
			console.log(b_Items[2][i].items.length);
		}
	}

	/* ************************************************************************ */

	/* Write date and all collections warnings / inconsistencies to errors.txt */
	fs.appendFileSync(filename, dateStr + log + '\n\n');
	console.log('Cross-site audit is complete.\n' + errorCount +
		' errors were discovered in total.  See errors.txt for details');
	fs.appendFileSync(changelog, dateStr + '\n');

	/* ************************************************************************ */

	console.log("Now ready to begin transferring items from %s to secondary sites",
		siteNames[0]);

	var missing = new Array();
	missing.push(null);

	// New array to store all item promises for all sites
	var totalItemPromises = new Array();

	for (var i = 1; i < numSites; i++) {
		missing.push(checkItems(a_Items[i], b_Items[i], siteNames[0], siteNames[i]));
		totalItemPromises.concat(addMissing(missing[i], webflowObjects[i], sharedData[i].a_IDs,
			sharedData[i].b_IDs, a_Schema[i], b_Schema[i], a_Items[i], b_Items[i],
			sharedData[i].names, errorFreeCollections[i], siteNames[i]));
	}
	
	return totalItemPromises;

}).then(function() {

	fs.appendFileSync(changelog, '\n\n');
	
// 	// Write changes to changelog file
// 	fs.appendFileSync(changelog, dateStr + additions);

// 	// Configure email settings
// 	var transporter = nodemailer.createTransport({
// 		service: 'gmail',
// 		auth: {
// 			user: 'autoreportsender1@gmail.com',
// 			pass: '2468wryisfhkxvn,'
// 		}
// 	});

// 	// Format mail text and set mail options

// 	var html = '<h3>Error Log</h3><span style="font-family: Lucida Console"><p>' +
// 	log + '</p></span>' + '<h3>Change Log</h3><p><span style="font-family: Lucida Console">' +
// 	additions + '</span></p>';

// 	html = html.replace(/(?:\r\n|\r|\n)/g, '<br />');
// 	html = html.replace(/WARNING:/g, '<span style="color: red"><b>WARNING:</b></span>');

// 	var mailOptions = {
// 		from: 'autoreportsender1@gmail.com',
// 		to: 'leavitts@wharton.upenn.edu',
// 		subject: 'Webflow Synchronization Report --> Errors / Changelog',
// 		html: html
// 	}

// 	transporter.sendMail(mailOptions, function(err, info) {
// 		if (err) {
// 			console.log(err);
// 		} else {
// 			console.log('Email sent: ' + info.response);
// 		}
// 	});

});


function addMissing(missing, siteObj, a_IDs, b_IDs, a_Schema, b_Schema, a_Items, b_Items,
	sharedNames, errorFreeCollectionsEntry, b_Site) {

	/* Array of promises -- usage: Promise.all(addItemPromises).then("stuff that happens
	 * after all the items have been added...") */
	var addItemPromises = new Array();

	for (var i = 0; i < missing.length; i++) {
		// Move to next collection if this one has no missing items
		if (missing[i].length == 0) {
			continue;
		}
		for (var j = 0; j < missing[i].length; j++) {
			var item = missing[i][j];

			var answer = false;

			if (!settings.addItemsAutomatically) {
				// If user consents, proceed to add item to site
				answer = query("Add item " + chalk.magenta(item.name) + sprintf(
					" to collection \"%s\" in %s?", sharedNames[i], b_Site));
			}
			if (settings.addItemsAutomatically || answer) {
				console.log("Now adding \"%s\"...\n", item.name);

				// Create new item, to be pushed to website eventually
				var newItem = new Object();
				var keys = Object.keys(item);
				var okayToProceed = true;

				for (var k = 0; k < keys.length; k++) {
					var key = keys[k];
					if (key == '_id' || key == '_cid' || key == 'updated-on' ||
						key == 'updated-by' || key == 'created-on' || key == 'created-by' ||
						key == 'published-on' || key == 'published-by') {
						// Do nothing (i.e. do not copy these fields over to new item)
						continue;
					}
					// Get corresponding fields for given key
					var fields = b_Schema[i].fields;
					for (var m = 0; m < fields.length; m++) {
						if (fields[m].slug == key) {
							// console.log(key);
							// console.log(fields[m]);

							switch (fields[m].type) {
							case 'ImageRef':

								/* NOTICE:
								 * This endpoint has not yet been implemented in the webflow API.
								 * For now, all images will have to be uploaded manually >:{
								 */

								/* In the meantime, download images into folder to help facilitate
								 * the easiest possible upload process */

								 /* <><><><><><><><><><><><><><><><><><><><><><><><><><><> */

								// Directory names cannot include these characters:
								function clean (str) {
									return str.replace(/[/:*?<>|\\']/g, '');
								}

								/* Image is placed in directory w/ following format:
								 * Site name -> Collection name -> Item name
								 * ... and the name of the file itself is the slug of the field
								 * to which it corresponds */
								makeDirectory(["Images", clean(b_Site), clean(sharedNames[i]),
									clean(item.name)]);

								var imageURL = item[key].url;
								var imageName = '/' + clean(b_Site) + '/' + clean(sharedNames[i]) +
									'/' + clean(item.name) + '/' + clean(fields[m].slug);

								downloadImage(imageURL, 'Images' + imageName, function() {
									// console.log('Just finished downloading ' + imageName);
								})

								break;

							case 'ItemRef':

								var itemCorrespondingName = "ITEM NOT FOUND";

								// Get collection where itemRef must reside
								// (This is found in validations)
								var collectionId = fields[m].validations.collectionId;
								var index = b_IDs.indexOf(collectionId);

								if (errorFreeCollectionsEntry[index] == false) {
									console.log(warning("WARNING:") + " Execution failed. " +
										"%s contains a reference to an item in collection %s, which had errors.\n" +
										"Fix the errors in that collection, and try again.",
										item.name, sharedNames[index]);
										okayToProceed = false;
										break;
								}

								/* Search through collection and try to find relevant item, which
								 * constitute part of the field attribute value.  Find the name
								 * which corresponds with the ID */
								for (var n = 0; n < a_Items[index].items.length; n++) {
									if (item[key].indexOf(a_Items[index].items[n]._id) != -1) {
										itemCorrespondingName = a_Items[index].items[n].name;
									}
								}
								/* Now find the ID (for the *OTHER* site) that corresponds with
								 * the name gathered just above, and set value of newID to it,
								 * which will serve as the value for item, which will then be all
								 * ready for being uploaded */
								var newID = "ID NOT FOUND";

								for (var n = 0; n < b_Items[index].items.length; n++) {

									if (itemCorrespondingName == b_Items[index].items[n].name) {

										newID = b_Items[index].items[n]._id;
									}
								}
								// Finally, set value of the attribute.
								newItem[key] = newID;								
								break;

							case 'ItemRefSet':
								var itemCorrespondingNames = new Array();

								// Get collection where itemRef must reside
								// (This is found in validations)
								var collectionId = fields[m].validations.collectionId;
								var index = b_IDs.indexOf(collectionId);

								if (errorFreeCollectionsEntry[index] == false) {
									console.log(warning("WARNING:") + " Execution failed. " +
										"%s contains a reference to an item in collection %s, which had errors.\n" +
										"Fix the errors in that collection, and try again.",
										item.name, sharedNames[index]);
										okayToProceed = false;
										break;
								}

								/* Search through collection and try to find relevant items, which
								 * constitute part of the field attribute value.  Find the names
								 * which correspond with the IDs */
								for (var n = 0; n < a_Items[index].items.length; n++) {
									if (item[key].indexOf(a_Items[index].items[n]._id) != -1) {
										itemCorrespondingNames.push(a_Items[index].items[n].name);
									}
								}
								/* Now find the IDs (for the *OTHER* site) that correspond with
								 * the names gathered just above, and push them to new array
								 * which will store the value of the field attribute for the
								 * item, which will then be all ready for being uploaded */
								var newIDs = new Array();

								for (var n = 0; n < b_Items[index].items.length; n++) {

									if (itemCorrespondingNames.indexOf(b_Items[index].items[n].name) != -1) {
										// console.log(b_Items[index].items[n].name);
										// console.log(b_Items[index].items[n]._id);

										newIDs.push(b_Items[index].items[n]._id);
									}
								}
								// Finally, set value of the attribute.
								newItem[key] = newIDs;								
								break;

							/* Default behavior is to simply copy the value of the item being transferred,
							 * without any changes whatsoever */
							default:
								// copy item field to new item
								newItem[key] = item[key];
							}
						}
					}

				}



				/* *********************************** */
				if (okayToProceed) {
					siteObj.createItem({
						collectionId: b_IDs[i],
						fields: newItem
					});
				console.log("Added \"%s\" to %s! It is now staged for publish.",
					newItem.name, b_Site);
				fs.appendFileSync(changelog, sprintf("%s: Added \"%s\" to collection \"%s\"\n",
					b_Site, newItem.name, sharedNames[i]));
				}
			}
		}
	}
	return addItemPromises;
}

function checkCollectionAttributes(a_Schema, b_Schema, a_Site, b_Site, sharedData) {

	var errorFreeCollections = new Array();

	for (var i = 0; i < sharedData.names.length; i++) {

		var namesMatch = true;
		var slugsMatch = true;
		var singularNamesMatch = true;
		var fieldsMatch = true;

		function generateErrorMessage(attribute) {
			return sprintf("WARNING: %s %s does not equal %s %s for collection: " +
				"%s\n\t-- %s %s: %s\n\t-- %s %s: %s\n", a_Site, attribute, b_Site,
				attribute, sharedData.names[i], a_Site, attribute,
				a_Schema[i][attribute], b_Site, attribute, b_Schema[i][attribute]);
		}

		// Verify that corresponding collections have same name attribute
		/* (note: should always be true, since for the sake of comparison, collections
	 	 *  are defined by their name in this implementation) */
		if (a_Schema[i].name != b_Schema[i].name) {
			log += generateErrorMessage('name');
			namesMatch = false;
			errorCount++;
		}

		// Verify that corresponding collections have same slug attribute 
		if (a_Schema[i].slug != b_Schema[i].slug) {
			log += generateErrorMessage('slug');
			slugsMatch = false;
			errorCount++;
		}

		// Verify that corresponding collections have same singularName attribute 
		if (a_Schema[i].singularName != b_Schema[i].singularName) {
			log += generateErrorMessage('singularName');
			singularNamesMatch = false;
			errorCount++;
		}

		/* *********************************************************** */
		/* Verify that corresponding collections have identical fields */
		/* *********************************************************** */

		/* Create copy of object to be used for comparisons.  We can delete and
		 * modify this copy as we please, without dealing with unexpected consequences
		 * down the line. */
		var a_Fields = JSON.parse(JSON.stringify(a_Schema[i].fields));
		var b_Fields = JSON.parse(JSON.stringify(b_Schema[i].fields));

		/* Perform deep-search of object (including nested objects and arrays)
		 * and delete any instance of the "id" attributes to facilitate comparisons.
		 * We do not want to check for equality of IDs among sites.
		 * Moreover, we do not need to use any IDs for any purpose.
		 */
		removeAll(a_Fields, "id");
		removeAll(b_Fields, "id");
		removeAll(a_Fields, "_id");
		removeAll(b_Fields, "_id");
		removeAll(a_Fields, "collectionId");
		removeAll(b_Fields, "collectionId");
		 /* Clean out any empty, null, undefined, etc. values, by performing a deep
		  * recursive search of the object */
		a_Fields = removeEmpty(a_Fields);
		b_Fields = removeEmpty(b_Fields);

		if (a_Fields.length != b_Fields.length) {
			log += sprintf("WARNING: %s and %s differ in # of fields for category:" +
				"\n\t-- %s\n", a_Site, b_Site, sharedData.names[i])
			fieldsMatch = false;
			errorFreeCollections.push(false);
			errorCount++;
			continue;
		}
		for (var j = 0; j < a_Fields.length; j++) {
			var a_Field = a_Fields[j];
			var b_Field = b_Fields[j];
			var a_Keys = Object.keys(a_Field);
			var b_Keys = Object.keys(b_Field);

			// Handle missing attributes for any given field in a collection
			var a_Missing = new Array();
			var b_Missing = new Array();
			determineMissingAttributes(a_Field, b_Field, a_Missing, b_Missing);

			if (a_Missing.length != 0 || b_Missing.length != 0) {

				if (a_Missing.length != 0) {
					log += sprintf("WARNING: Missing attribute(s) in %s, collection \"" +
						"%s\", field \"%s\":\n", a_Site, sharedData.names[i], a_Field.name);
					errorCount++;
					for (var k = 0; k < a_Missing.length; k++) {
						log += sprintf("\t-- %s\n", a_Missing[k]);
					}
				}
				if (b_Missing.length != 0) {
					log += sprintf("WARNING: Missing attribute(s) in %s, collection \"" +
						"%s\", field \"%s\":\n", b_Site, sharedData.names[i], b_Field.name);
					errorCount++;
					for (var k = 0; k < b_Missing.length; k++) {
						log += sprintf("\t-- %s\n", b_Missing[k]);
					}
				}
				fieldsMatch = false;

			} else {
				for (var k = 0; k < a_Keys.length; k++) {
					var key = a_Keys[k];
					var a_Value = a_Field[key];
					var b_Value = b_Field[key];

					// Handle "validations," which is an object within a field entry
					if (a_Value !== null && typeof a_Value === 'object') {

						if (b_Value === null || typeof b_Value !== 'object') {
							log += sprintf("WARNING: In collection \"%s\", field \"%s\":" +
								"\n\t-- attribute \"%s\" is an object for %s but not " +
								"%s!\n", sharedData.names[i], a_Field['name'],
								key, a_Site, b_Site);
							fieldsMatch = false;
							errorCount++;

						} else {
							/* Print error message if validation field is not identical
							 * for A and B. */
							if (!_.isEqual(a_Value, b_Value)) {
								var msg = sprintf("WARNING: In collection \"%s\", field \"%s\":" +
									"\n\t-- *object* attribute \"%s\" has an inconsistent value " +
									"between %s and %s\n", sharedData.names[i],
									a_Field['name'], key, a_Site, b_Site);
								log += sprintf("\t-- %s:\n%s\n", a_Site, JSON.stringify(a_Value));
								log += sprintf("\t-- %s:\n%s\n", b_Site, JSON.stringify(b_Value));
								fieldsMatch = false;
								errorCount++;
							}
						}
						continue;
					}

					/* Undefined and blank defined to be equal
					 *
					 * Equivalent is arbitrarily defined to be true if the key being tested is ID,
					 * since ID is expected, in many cases, to differ between the two sites.
					 * */

					var equivalent = (a_Value == b_Value || (a_Value == null &&
						b_Value == "") || (a_Value == "" && b_Value == null) || key == "id");
					// Print error message if objects are not equivalent
					if (!equivalent) {
						log += sprintf("WARNING: In collecion \"%s\", field \"%s\":" +
							"\n\t-- attribute \"%s\" has an inconsistent value between " +
							"%s and %s\n\t\t-- %s value: %s\n\t\t-- %s value: %s\n",
							sharedData.names[i], a_Field['name'], key, a_Site, b_Site,
							a_Site, a_Field[key], b_Site, b_Field[key]);
						fieldsMatch = false;
						errorCount++;
					}
				}
			}
		}

		// If no errors occurred, update corresponding errorFreeCollections flag
		errorFreeCollections.push(namesMatch && slugsMatch && singularNamesMatch && fieldsMatch);
	}
	return errorFreeCollections;
}


// Takes as input two objects and two empty arrays
function determineMissingAttributes(a_Object, b_Object, a_Missing, b_Missing) {
	var a_Keys = Object.keys(a_Object);
	var b_Keys = Object.keys(b_Object);

	for (var i = 0; i < a_Keys.length; i++) {
		var key = a_Keys[i];
		var index = b_Keys.indexOf(key);

		// only push key to missing list if its value is not blank or null
		if (index == -1 && a_Object[key] !== null && a_Object[key] !== '') {
			b_Missing.push(key);
		} else {
			// remove element from b_Keys, if it exists
			if (index != -1) {
				b_Keys.splice(index, 1);
			}
		}
	}

	// any element remaining in b_Keys is missing from a.
	a_Missing = b_Keys.slice()
}


// For debugging

/* NEED TO FIX THIS */

function examineCollection(collectionName, a_Schema, b_Schema, a_Site, b_Site) {
	for (var i = 0; i < sharedData.names.length; i++) {

		if (sharedData.names[i] == collectionName) {
			var a_Fields = a_Schema[i].fields;
			var b_Fields = b_Schema[i].fields;
			for (var j = 0; j < a_Fields.length; j++) {
				console.log("%s: " + JSON.stringify(a_Fields[j]), a_Site);
				console.log("%s: " + JSON.stringify(b_Fields[j]), b_Site);
			}
		}
	}
}


function removeAll(obj, attribute) {
	// Do nothing if obj is null
	if (obj == null) {
		return;
	}
	// If obj is array, iterate through all elements and recursively apply this function
	if (Array.isArray(obj)) {
		for (var i = 0; i < obj.length; i++) {
			removeAll(obj[i]);
		}
	}
	/* If obj is object, remove attribute if it exists.  Also recursively apply this
	 * function to any attributes which are themselves arrays or objects */
	if (typeof obj == "object") {
		if (obj.hasOwnProperty(attribute)) {
			delete obj[attribute];
		}
		var keys = Object.keys(obj);
		for (var i = 0; i < keys.length; i++) {
			if (typeof obj[keys[i]] == "object" || Array.isArray(obj[keys[i]])) {
				removeAll(obj[keys[i]], attribute);
			}
		}
	}
}


function removeEmpty(obj) {
  	return function prune(current) {
	    _.forOwn(current, function (value, key) {
	    	if (_.isUndefined(value) || _.isNull(value) || (_.isString(value) && 
	    		_.isEmpty(value)) || (_.isObject(value) && _.isEmpty(prune(value)))) {
	        	delete current[key];
	    	}
	    });
	    // remove any leftover undefined values from the delete operation on an array
	    if (_.isArray(current)) {
	    	_.pull(current, undefined);
	    }
	    return current;
  	} (_.cloneDeep(obj));  // Do not modify the original object, create a clone instead
}


function checkItems(a_Items, b_Items, a_Site, b_Site) {
	// 2D array to hold missing items
	var result = new Array();
	for (var i = 0; i < a_Items.length; i++) {
		if (a_Items[i] == null || b_Items[i] == null) {
			result.push(new Array());
			continue;
		}
		var a_Entries = a_Items[i].items;
		var b_Entries = b_Items[i].items;

		var missing = getMissingEntries(a_Entries, b_Entries);
		result.push(missing);
	}
	return result;
}


function getMissingEntries(a_Entries, b_Entries) {
	var missing = new Array();
	// create array of b slugs only, to facilitate searching
	var b_Slugs = new Array();
	for (var i = 0; i < b_Entries.length; i++) {
		b_Slugs.push(b_Entries[i]['slug']);
	}
	for (var i = 0; i < a_Entries.length; i++) {
		var entrySlug = a_Entries[i]['slug'];
		var index = b_Slugs.indexOf(entrySlug);
		if (index == -1) {
			// Push corresponding item to missing array
			missing.push(a_Entries[i]);
		}
	}
	return missing;
}


function promiseWhile(condition, action) {
	var resolver = Promise.defer();
	var loop = function() {
		if(!condition()) return resolver.resolve();
		return Promise.cast(action())
			.then(loop)
			.catch(resolver.reject);
	};

	process.nextTick(loop);

	return resolver.promise;
};

function printWaitTime(siteName, remaining) {
	// Move up one line
	process.stdout.moveCursor(0, -1);
	// Clear line
	process.stdout.clearLine();
	// Move cursor to start of line
	process.stdout.cursorTo(0);
	// Write output to line
	process.stdout.write(chalk.yellow(sprintf("<<Intentionally slowing in %s to avoid rate limit - Remaining hits: %s>>",
		siteName, remaining)));
	// Move cursor back to start of next line
	process.stdout.moveCursor(0, 1);
	process.stdout.cursorTo(0);
}

function clearLineAbove() {
	process.stdout.moveCursor(0, -1);
	process.stdout.clearLine();
	process.stdout.moveCursor(0, 1);
	process.stdout.cursorTo(0);
}

function downloadImage(uri, filename, callback) {
	request.head(uri, function(err, res, body) {

		var contentType = res.headers['content-type'];
		// Do nothing and immediately return if content is not an image
		if (contentType.substring(0,5).toLowerCase() != "image") {
			return;
		}

		// Get image type (e.g. png, jpg, etc.)
		var index = contentType.indexOf('/') + 1;
		var imageType = contentType.substring(index).toLowerCase();

		request(uri).pipe(fs.createWriteStream(filename + '.' + imageType)).on('close', callback);
	});
}

function makeDirectory(dir) {
	var c = '.';
	for (var i = 0; i < dir.length; i++) {
		// Remove any characters that are not allowed in directory name
		c += ('/' + dir[i]);
		try {
			fs.mkdirSync(c)
		} catch (err) {
			// IF error is that directory already exists, ignore the error.
			// Otherwise, throw any other type of error
			if (err.code !== 'EEXIST') {
				throw err
			}
		}
	}
}
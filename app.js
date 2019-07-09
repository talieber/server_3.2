//imports
const express = require('express');
const app = express();
app.use(express.json());

var DButilsAzure = require('./DButils');

const jwt = require("jsonwebtoken");
const fs = require('fs');
const xml2js = require('xml2js');	
const parser = new xml2js.Parser();

var bodyParser = require('body-parser');
var cors = require('cors');
app.use(bodyParser.json(),cors());
app.options('*',cors());

//define the server's secret key word 
secret = "TalAndYafit"

//creating local host
const port = process.env.PORT || 3000; //environment variable
app.listen(port, () => {
	console.log(`Listening on port ${port}`);
});

//getPOIDetails/:POIName
app.get('/getPOIDetails/:POIName', function(req, res){
	DButilsAzure.execQuery("SELECT a.poi_name, description, views_number, category, picture, username, rank, review, review_date "+
							"FROM POI AS a LEFT JOIN POIReviews as b ON a.poi_name = b.poi_name "+
							"WHERE a.poi_name = '"+req.params.POIName+"' "+
							"ORDER BY review_date DESC")
    .then(function(result){
		if (result.length > 0 ){
			var sumRank = 0;
			for ( var i = 0; i < result.length; i++){
				sumRank += result[i].rank;
			}
			var avgRank = sumRank/result.length;
			var finalResult = result[0].poi_name+", "+result[0].description+", "+result[0].views_number+", "+result[0].category+", "+avgRank+
								", "+result[0].review+", "+result[0].review_date;
			if (result.length > 1){
				finalResult = finalResult.concat(", "+result[1].review+", "+result[1].review_date)
			}
			finalResult = finalResult.concat(", "+result[0].picture);
			var viewsNumber=parseInt(result[0].views_number,10)+1;
			DButilsAzure.execQuery("UPDATE POI SET views_number ="+viewsNumber+" WHERE  poi_name = '"+result[0].poi_name+"'")
			console.log(result.length)
			console.log(finalResult)
			res.send(finalResult)
		}
		else{
			res.status(404).send("The given point of view wasn't found in the system.")
		}
    })
    .catch(function(err){
        res.status(400).send(err)
    })
})

//addUser
app.post('/addUser', (req,res) => {
	var checkCountry=true;
	const xmlfile = './resources/countries.xml';
    fs.readFile(xmlfile, 'utf8' ,function (error, text) {
        if (error) {
            res.status(500).send(`could not read file countries.xml: ${error}`);
        }
        else {
            try{
                parser.parseString(text, function (err, result) {
					const countries = result['Countries']['Country'];
					
                    const countriesNames = countries.map((country)=> country.Name[0]);
                    if(!countriesNames.includes(req.body.country)){
						res.status(400).send("Given country is not match to countries list");
					}
					else{
						if (!req.body.username || !req.body.firstName || !req.body.lastName || !req.body.city || !req.body.country || !req.body.email || !req.body.interestsList
							|| !req.body.firstQuestionNum || !req.body.firstAnswer || !req.body.secondQuestionNum || !req.body.secondAnswer || !req.body.pass){
								res.status(400).send("All fields must be filled.")
							}
						else if (req.body.username.length < 3 || req.body.username.length > 8){
							res.status(400).send("Username must contain at least 3 characters and no more then 8 characters.")
						}
						else if (!(/^[a-zA-Z]+$/.test(req.body.username))){
							res.status(400).send("Username must contain only letters.")
						}
						else if (req.body.pass.length < 5 || req.body.pass.length > 10){
							res.status(400).send("Password must contain at least 5 characters and no more then 10 characters.")
						}
						else if (!(/^[A-z0-9]+$/.test(req.body.pass))){
							res.status(400).send("Password must contain only letters or digits.")
						}
						else if (req.body.interestsList.length < 2){
							res.status(400).send("You must choose at least 2 interest fields.")
						}
						else{
							DButilsAzure.execQuery("INSERT INTO Users (username, first_name, last_name, city, country, email, first_question_num, first_answer ,second_question_num, second_answer, password)"+
							"VALUES ('"+req.body.username+"', '"+req.body.firstName+"', '"+req.body.lastName+"', '"+req.body.city+"', '"+req.body.country+"', '"+req.body.email+
							"', "+req.body.firstQuestionNum+", '"+req.body.firstAnswer+"', "+req.body.secondQuestionNum+", '"+req.body.secondAnswer+"','"+req.body.pass+"');")
							.then(function(result){
							})
							.catch(function(err){
								console.log(err)
								if (err.number === 2627){
								res.status(400).send("Username already exists. Pleace choose another username.")
								}
								else{
									res.status(400).send(err)
								}
							})
							req.body.interestsList.forEach(element => {
								DButilsAzure.execQuery("INSERT INTO UserInterests (username, category) VALUES ('"+req.body.username+"', '"+element+"')")
								.then(function(result){
									res.status(201).send("New user was added successfuly")
								})
								.catch(function(err){
									console.log(err)
									if (err.number === 2627){
									res.status(400).send("Username already exists. Pleace choose another username.")
									}
									else{
										res.status(400).send(err)
									}
								})
							});
						}
					}//else
				});
			}
			catch(err){
				res.status(500).send(`could not parse countries.xml: ${err}`);
			}
		}
	})
})

//getVerQuestions
app.get('/getVerQuestions/:username', function(req, res){
	DButilsAzure.execQuery("SELECT first_question_num, second_question_num FROM Users WHERE username= '"+req.params.username+"'")
    .then(function(result){
		if (result.length == 0){
			res.status(400).send("Username is not exist in the system.")
		}
		else {
			res.status(200).send(result)
		}
    })
    .catch(function(err){
        console.log(err)
        res.send(err)
    })
})

//restorePassword
app.post('/restorePass', function(req, res){
	if (!req.body.username || !req.body.questionNum || !req.body.answer){
		res.status(400).send("All fields must be filled.")
	}
	else{
		DButilsAzure.execQuery("SELECT CASE "+
        								"WHEN first_question_num = "+req.body.questionNum+" THEN first_answer "+
        								"WHEN second_question_num = "+req.body.questionNum+" THEN second_answer "+
        								"END AS answer "+
								"FROM Users WHERE username= '"+req.body.username+"'")
		.then(function (result){
			if (result.length < 1){
				res.status(404).send("Can't find username or question.")
			}
			else if (req.body.answer === result[0].answer){
				DButilsAzure.execQuery("SELECT password FROM Users WHERE username= '"+req.body.username+"'")
				.then(function(result2){
					res.status(200).send(result2)
				})
				.catch(function(err){
					console.log(err)
					res.status(400).send(err)
				})
			}
			else{
				res.send("Answer is incorrect. Can't restore you'r password.")
			}
		})
		.catch(function(err){
			console.log(err)
			res.send(err)
		})
	}
})

//getRandomPOI/:rank
app.get('/getRandomPOI/:rank', function(req, res){
	if(isNaN(req.params.rank))
		res.status(400).send("Rank must be number")
	if(req.params.rank>5)
		res.status(400).send("Maximum rank is 5 ")

	DButilsAzure.execQuery("SELECT top 3 sub.poi_name,picture FROM(SELECT  poi_name, AVG(Cast(rank as Float)) as avg_rank FROM POIReviews GROUP BY poi_name) sub LEFT JOIN POI AS a ON sub.poi_name=a.poi_name"+
	" WHERE avg_rank>= '"+req.params.rank+"' ORDER BY NEWID()")
    .then(function(result){
		if(result.length == 0){
			res.status(404).send("Can't find points of interest above this rank.")
		}
        res.send(result)
    })
    .catch(function(err){
        console.log(err)
        res.send(err)
    })
})

//login
app.post("/login", (req, res) => {
	if (!req.body.username || !req.body.password){
		res.status(400).send("Username and password must be entered.")
	}
	else{
		DButilsAzure.execQuery("SELECT password FROM Users WHERE username= '"+req.body.username+"'")
		.then(function(result){		
			if (result.length == 0){
				res.status(400).send("Username was not found in the system.")
			}
			else if (req.body.password == result[0].password){
				payload = { username: req.body.username};
				options = { expiresIn: "1d" };
				const token = jwt.sign(payload, secret, options);
				res.status(200).send(token);
			}
			else{
				res.status(401).send("Password is incorrect.")
			}
		})
		.catch(function(err){
			console.log(err)
			res.status(400).send(err)
		})
	}
});


//getPopularPOI
app.get('/getPopularPOI', function(req, res){
	const token = req.header("x-out-token")
	if (!token) 
		res.status(401).send("No token provided.")
	try {
		const decoded = jwt.verify(token, secret);
		req.decoded = decoded;
		var finalResult = "";
		DButilsAzure.execQuery("SELECT TOP 2 category FROM UserInterests WHERE username = '"+req.decoded.username+"' ORDER BY NEWID()")
		.then(function(result){
			var counter = 0
			result.forEach(element => {
				//res.send(element.category)
				DButilsAzure.execQuery("SELECT TOP 1 a.poi_name, a.picture FROM POI AS a LEFT join "+ 
				"(SELECT  poi_name, AVG(Cast(rank as Float)) as avg_rank FROM POIReviews GROUP BY poi_name) AS b "+
				 "ON a.poi_name = b.poi_name "+
				"WHERE category = '"+element.category+"' "+
				"ORDER BY avg_rank DESC")//TODO: need to add: select top 1 poi_name and picture
				.then(function(result2){
					finalResult =finalResult.concat(result2[0].poi_name+", "+result2[0].picture+", ");
					counter++
					if (counter === 2){
						finalResult = finalResult.substring(0, finalResult.length - 2);
						res.status(200).send(finalResult)
					}
				})
				.catch(function(err){
					console.log(err)
					res.status(404).send(err)
				})
			})
		})
		.catch(function(err){
			console.log(err)
			res.status(404).send(err)
		})
	}
	catch (exception){
		res.status(400).send("Invalid token.")
	}
})

//getSavedPOI
app.get('/getSavedPOI', function(req, res){
	const token = req.header("x-out-token")
	if (!token) res.status(401).send("No token provided.")
	try {
		const decoded = jwt.verify(token, secret);
		req.decoded = decoded;
		var finalResult="";
		DButilsAzure.execQuery("SELECT saved.poi_name, saved.poi_place, category, picture, rank "+
								"FROM UsersSavedPOIs as saved LEFT JOIN "+
										"(SELECT a.poi_name, category, picture, AVG(rank) as rank "+
										"FROM POI AS a "+
										"LEFT JOIN POIReviews as b "+
										"ON a.poi_name = b.poi_name "+
										"GROUP BY a.poi_name, category, picture) as notSaved "+
										"ON saved.poi_name = notSaved.poi_name "+
								"WHERE username = '"+req.decoded.username+"' "+
								"ORDER BY rank DESC")
		.then(function(result){
			if (result.length == 0){
				res.status(404).send("Saved points of view weren't found for this user.")
			}
			else{
			res.status(200).send(result)
			}
		})
		.catch(function(err){
			console.log(err)
			res.status(404).send(err)
		})
	}
	catch (exception){
		res.status(400).send("Invalid token.")
	}
})

//addSavedAndSortedPOIs
app.post("/addSavedAndSortedPOIs", (req, res) => {
	if (!req.body.POIs || !req.body.places){
		res.send("You must provide points of view for saving.")
	}
	else if(req.body.POIs.length > req.body.places.length){
		res.send("You must provide for each point of view a place for saving.")
	}
	else if(req.body.POIs.length < req.body.places.length){
		res.send("You can't provide a place without point of interest for saving.")
	}
	else{
		const token = req.header("x-out-token")
		if (!token) res.status(401).send("No token provided.")
		try {
			const decoded = jwt.verify(token, secret);
			req.decoded = decoded;
			DButilsAzure.execQuery("DELETE FROM UsersSavedPOIs WHERE username = '"+req.decoded.username+"'")
			.then(function(){
			})
			.catch(function(err){
				res.status(400).send(err)
			})
			if (req.body.POIs.length != 0 && req.body.places.length != 0){
				for (var i = 0; i < req.body.POIs.length; i++){
					DButilsAzure.execQuery("INSERT INTO UsersSavedPOIs (username, poi_name, poi_place) "+
					"VALUES ( '"+req.decoded.username+"', '"+req.body.POIs[i]+"', "+req.body.places[i]+");")
					.then(function(result){
					})
					.catch(function(err){
						res.status(400).send(err)
					})
				}
			}
			res.status(200).send("Your points of intersest were saved successfuly.")
		}
		catch (exception){
			res.status(400).send("Invalid token.")
		}
	}
});

//addNewReview
app.post("/addNewReview", (req, res) => {
	if (!req.body.POIName || !req.body.rank || !req.body.content){
		res.status(400).send("All fields must be filled.")
	}
	else{
		const token = req.header("x-out-token")
		if (!token) res.status(401).send("No token provided.")
		try {
			const decoded = jwt.verify(token, secret);
			req.decoded = decoded;
			DButilsAzure.execQuery("INSERT INTO POIReviews (poi_name, username, review_date, rank, review)"+
			"VALUES ( '"+req.body.POIName+"', '"+req.decoded.username+"', GETDATE(), "+req.body.rank+", '"+req.body.content+"');")
			.then(function(result){
				res.status(201).send("Your review was added successfuly")
			})
			.catch(function(err){
				console.log(err)
				if (err.number === 2627){
				res.status(404).send("You've already entered review about this point of interest. You can only do it once.")
				}
				else{
					res.status(400).send(err)
				}
			})
		}
		catch (exception){
			res.status(400).send("Invalid token.")
		}
	}
});

//getAllRanks/:POIName
app.get('/getAllRanks/:POIName', function(req, res){
	DButilsAzure.execQuery("SELECT rank FROM POIReviews WHERE poi_name = '"+req.params.POIName+"'")
    .then(function(result){
        res.send(result)
    })
    .catch(function(err){
        console.log(err)
        res.send(err)
    })
})

//getCountries
app.get('/getCountries',function (req,res){
	const xmlfile = './resources/countries.xml';
    fs.readFile(xmlfile, 'utf8' ,function (error, text) {
        if (error) {
            res.status(500).send(`could not read file countries.xml: ${error}`);
        }
        else {
                parser.parseString(text, function (err, result) {
					const countries = result['Countries']['Country'];
					const countriesNames = countries.map((country)=> country.Name[0]);
					res.send(countriesNames)
			});
		}
	});
})

//getPOIS
app.get('/getAllPoi', function(req, res){
	DButilsAzure.execQuery("SELECT a.poi_name, category, picture, AVG(rank) as rank FROM POI AS a LEFT JOIN POIReviews as b "+
			"ON a.poi_name = b.poi_name "+
	"GROUP BY a.poi_name, category, picture "+
	"ORDER BY rank DESC")
    .then(function(result){
		if (result.length > 0 ){
		
			res.send(result)
		}
		else{
			res.status(404).send("There is no POI in the system")
		}
    })
    .catch(function(err){
        res.status(400).send(err)
    })
})





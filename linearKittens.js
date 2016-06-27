// Uses owl-deepcopy: http://oranlooney.com/static/javascript/deepCopy.js
// and Numeric Javascript: http://numericjs.com/numeric/index.php
document.body.appendChild(document.createElement('script')).src='http://www.oranlooney.com/static/javascript/deepCopy.js';
document.body.appendChild(document.createElement('script')).src='http://numericjs.com/numeric/lib/numeric-1.2.6.js';

// Number of ticks every second
ticksPerSecond = gamePage.rate; //5

/* Maximum fraction of resource cap that we can score and use to build.  Useful
because it helps prevent loss from steamworks automation. This is subdivided into
automationResourceCap, which applies to wood, minerals, and iron, scienceResourceCap,
which applies to science and faith, and resourceCap, which applies to all other
resources. */
automationResourceCap = 0.9;
scienceResourceCap = 0.999;
resourceCap = 0.99;

// Threshold for ignoring things in the linear programs
tradeThreshold = 1e-2;

// The most of any building that we can score for completing
maximumBuildingPercentage=1.2;

// the resource cutoff before assuming infinite
infiniteResources = 1e10;

// The ideal number of trade ships
maxTradeShips=5000;

// number of new trade ships as fraction of current that should be considered equivalently
// valuable to a new building.  Set this lower if you want linearKittens to buy more
// trade ships
tradeShipMultiplier=0.2;

// The fraction of our max catnip that we will reserve for spontaneous season changes
catnipReserve=0.05;

// The time between instances of running the planning and execution loops
planningInterval = 60;
executionInterval = 5;

/* Determine whether linearKittens pauses the game while it executes the planning loop.
This could be useful on slower computers or if gamePage.rate is large.  Leaving it on
will cause a 10-30% slow-down in game speed.  This can be modified after loading the
script. */
pauseDuringCalculations = true;

// If autoBuy is on, linearKittens will buy the buildings that it has planned for.
// If you are using linearKittens as a resource automation script, then you should
// set this to false;
autoBuy = true;

// If performUncappedTrades is false, linearKittens will not perform trades when the costs
// are uncapped.
// If you are using linearKittens as a resource automation script, then you should
// set this to false;
performUncappedTrades=true;

/* This adds additional utility in the LP for simply gathering additional resources.
The bonus provided is some fraction of the resource maximum which is multiplied by the
corresponding resourceWeight.
Increasing the weight of the faith resource will also tell linearKittens to ignore
the faith cap during calculations as long as scoreAccumulatedResources is true.*/
scoreAccumulatedResources = false;
resourceWeights = {}; for (var i in gamePage.resPool.resources) {resourceWeights[gamePage.resPool.resources[i].name]=1;}

// This tells the LP to only build buildings that house kittens: useful for the very end game
// Alternatively, this tells the LP to not build housing at all for IW mode
onlyBuildHousing = false;
doNotBuildHousing = false;
housingBlds = ["Log House","Hut","Space Station","Mansion","Eludium Huts","Ironwood Huts","Concrete Huts","Unobtainium Huts"];

// Tell the LP that faith is unlimited.  This will be permit the LP to generate
// more faith while running scoreAccumulatedResources=true;
// I recommend not activating this, since it might turn your entire economy towards
// faith generation.
ignoreFaithCap = false;

// A click event to pass to onClick functions
genericEvent = {shiftKey:false};

// a randomly added quantity to the building weights
randomBuildingWeightScaling = 0.2;

// This determines whether building a building will stop execution and cause the planning loop to rerun.
// if allowedRepeatedBuilds is true, this will enable the exectution loop to buy multiple of the same
// building during each planning loop.
constructionResetsPlanning = true;
allowRepeatedBuilds = true;

// Scales the trade quantities to keep them within the dynamic range of the linear programming solver.
// Acts like the researchGlobalMax, but the trade range varies less, so we can be less careful.
tradeScaling = 1000;

// If quadraticBuildingsOn, then magnetos, steamworks, observatories and factories will always be set to
// on.  This may break everything if you have insufficiently many oil wells.
// Current plan is to disable this if a planning loop fails and then reenable an hour later.
quadraticBuildingsOn = true;
quadraticBuildingList = ["steamworks","magneto","factory","observatory","biolab","reactor","moonBase","spaceStation","accelerator","orbitalArray"];

// The weights for the buildables, used to prioritize certain buildings or research
// The most consistant way to handle this is probably to calculate them when we read
// in the corresponding objects, but this will work for the moment..
// I've also hardcoded in a restriction regarding the timing of building
// huts in the early game and researching agriculture to prevent early game stalling
function buildableWeight(button) {
  if(button.name=="Buying some trade ships" && gamePage.resPool.get("ship").val>maxTradeShips) return 0.0001*(1+tradeShipMultiplier)/(tradeShipMultiplier); // much less important if over cap
  if(button.name=="Buying some trade ships") return (1+tradeShipMultiplier)/(tradeShipMultiplier); // the difference in value between current trade ships and target trade ships should be 1

  // housing is a special case
  if (doNotBuildHousing && indexOf(housingBlds,button.name)>=0) {return -1;} //don't break IW mode
  if (onlyBuildHousing && indexOf(housingBlds,button.name)<0) {return -1;} //late endgame

  if(button.name=="Catnip Field") return 5;
  if(button.name=="Hut"  && gamePage.bld.get("hut").val>0 && !gamePage.science.get("agriculture").researched)
    {return -1;} //hack: don't build a second hut until we have farmers

  if (button.tab && button.tab.tabId=="Workshop") {return 10;}
  if (button.tab && button.tab.tabId=="Science") {return 10;}
  if ('transcendence' in button) {return 10;}//Order of Light objects

  if (indexOf(getValues(button.getPrices(),"name"),"timeCrystal")>=0) {return -1;} // don't spend time crystals
  return 1;
}


// The function that generates the resource caps.  This can be customized as desired.
function getResourceMax(resource) {
  var cap = resource.maxValue;
  if (cap==0) {return Infinity;}

  if(resource.name=="wood"||resource.name=="minerals"||resource.name=="iron") {
    return cap*automationResourceCap;
  }
  if(resource.name=='faith'&&scoreAccumulatedResources&&resourceWeights['faith']>1) {
      return Infinity; // special dispensation to allow the AI to agressively pursue faith.
  }
  if(resource.name=="science"||resource.name=="faith") {
    return cap*scienceResourceCap;
  }
  return cap*resourceCap;
}

//indexOf will return the index of content in object.  Only works for arrays.
function indexOf (object,content) {
  for (var i=0;i<object.length;i++) {
    if (object[i]==content) {return i;}
  }
  return -1;
}

//range
function range (n) {
  var out = [];
  for(var i=1;i<=n;i++) {
    out.push(i);
  }
  return out;
}

// Spawns a new copy of gamePage into gameCopy to manipulate. Takes ~250ms,
// so we should use this sparingly.
function respawnCopy () {
  gameCopy = owl.deepCopy(gamePage);
  gameCopy.village.jobs = owl.deepCopy(gamePage.village.jobs);
}

// refreshTabs asks the game to redraw all the tabs.  We should run this frequently
// to make sure we find all the new buttons
function refreshTabs () {
  for(var i = 0; i<gamePage.tabs.length;i++) {
    if(gamePage.tabs[i].tabId=="Stats") {continue;}
    gamePage.tabs[i].render();
  }
}

// slices a property across an array.
function getValues (object,property) {
  var resourceNames = [];
  for (var i=0; i<object.length;i++) {
    if (typeof object[i][property] === "undefined") {
      resourceNames.push(0);
    } else {
      resourceNames.push(object[i][property]);
    }
  }
  return resourceNames;
}

// What happens to your resources when you press this button?
// prepay is false if payment handled by btn.handler(), e.g. with crafts
function getSingleTradeRate (button,prepay) {
  // set all current resources to 0.
  setCopyResourcesToZero();

  cost = button.getPrices();
  for(var j=0;j<cost.length;j++) {
    // find the corresponding resource.
    resourceFromName=gameCopy.resPool.get(cost[j].name);
    // set the value to exactly what we need.
    resourceFromName.value = cost[j].val;
  }

  // For the sacrifices, we need to make sure the button is enabled.
  // We could refresh the religion tab after changing resources, but this is easier.
  button.enabled=true;

  // now try the trade.
  beforeResources = getValues(gameCopy.resPool.resources,"value");
  if (prepay) {button.payPrice();}
  if (button.handler) {
    button.handler(button); // some of these may take 0 arguments, instead
  } else {
    button.onClick(genericEvent);
  }
  //for some reason, modifying gameCopy resources amounts changes the storage for gamePage instead.
  //we immediately correct for that.
  gamePage.upgrade(gamePage.workshop.getCraft("ship").upgrades)
  gamePage.upgrade(gamePage.workshop.getCraft("compedium").upgrades)

  afterResources = getValues(gameCopy.resPool.resources,"value");
  deltaResources = numeric.sub(afterResources,beforeResources);
  return deltaResources;
}

function getAverageTradeRate (amt,button,prepay) { //slow.  There should be a faster way.
  if (amt<1) {console.error("getAverageTradeRate: needs positive trade quantity.");}
  var rate = getSingleTradeRate(button,prepay);
  for (var i=1;i<amt;i++) {
    rate = numeric.add(rate,getSingleTradeRate(button,prepay));
  }
  return numeric.div(rate,amt);
}
function setCopyResourcesToZero () {
  resArray = gameCopy.resPool.resources;
  for (var i=0;i<resArray.length;i++) {
    resArray[i].value=0;
  }
}
function getSingelHuntRateWithoutCost () {
  setCopyResourcesToZero();
  var beforeResources = getValues(gameCopy.resPool.resources,"value");
  gameCopy.village.sendHuntersInternal();  //previously: gameCopy.villageTab.sendHunterSquad();
  var afterResources = getValues(gameCopy.resPool.resources,"value");
  var deltaResources = numeric.sub(afterResources,beforeResources);
  return deltaResources;
}

function getAverageHuntRate (amt) { //because fuck binding
  if (amt<1) {console.error("getAverageTradeRate: needs positive trade quantity.");}
  var rate = getSingelHuntRateWithoutCost();
  for (var i=1;i<amt;i++) {
    rate = numeric.add(rate,getSingelHuntRateWithoutCost());
  }
  var costVec = costToVector(gameCopy.villageTab.huntBtn.prices);
  return numeric.sub(numeric.div(rate,amt),costVec);
}

// compile all the trade-like buttons
// You should probably refreshTabs before this.
// Leviathans have a feed button that needs to be implemented
function getTradeRates () {
  var buttonlist = []; // a stored list of buttons, in case things change suddenly
  var returns = [];

  // Go through each of the actual trade rates, get the trade values, and
  // store the actual button for gamePage in buttonlist

  //hunt
  if (gamePage.villageTab.visible && gamePage.villageTab.huntBtn) {
    buttonlist.push(gamePage.villageTab.huntBtn);
    returns.push(getAverageHuntRate(100));
  }

  //trade
  if (gamePage.diplomacyTab.visible) {
    for (var i=0;i<gamePage.diplomacyTab.racePanels.length;i++) {
      // all the buttons that appear here are visible
      buttonlist.push(gamePage.diplomacyTab.racePanels[i].tradeBtn);
      returns.push(getAverageTradeRate(100,gameCopy.diplomacyTab.racePanels[i].tradeBtn,true));
    }
  }

  //craft
  if (gamePage.workshopTab.visible) {
    for (var i=0;i<gamePage.workshopTab.craftBtns.length;i++) {
      if (gamePage.workshopTab.craftBtns[i].visible) {
        buttonlist.push(gamePage.workshopTab.craftBtns[i]);
        returns.push(getSingleTradeRate(gameCopy.workshopTab.craftBtns[i],false));
      }
    }
  } else {
    // we can still craft catnip
    buttonlist.push(gamePage.workshopTab.craftBtns[0]);
    returns.push(getSingleTradeRate(gameCopy.workshopTab.craftBtns[0],false));
  }

  //religion
  if (gamePage.religionTab.visible) {
    if (gamePage.religionTab.refineBtn && gamePage.religionTab.refineBtn.visible) {
      buttonlist.push(gamePage.religionTab.refineBtn);
      returns.push(getSingleTradeRate(gameCopy.religionTab.refineBtn,false));
    }

    if (gamePage.religionTab.sacrificeAlicornsBtn && gamePage.religionTab.sacrificeAlicornsBtn.visible) {
      buttonlist.push(gamePage.religionTab.sacrificeAlicornsBtn);
      returns.push(getSingleTradeRate(gameCopy.religionTab.sacrificeAlicornsBtn,false));
    }

    if (gamePage.religionTab.sacrificeBtn && gamePage.religionTab.sacrificeBtn.visible) {
      buttonlist.push(gamePage.religionTab.sacrificeBtn);
      returns.push(getSingleTradeRate(gameCopy.religionTab.sacrificeBtn,false));
    }
  }

  return [buttonlist,returns];
}

// Ask the game to update perTickUI for all resources
// This make break with space production buildings
function recalculateProduction(game) {
  game.village.updateResourceProduction();

  game.village.invalidateCachedEffects();
  game.bld.invalidateCachedEffects();
  game.workshop.invalidateCachedEffects();
  game.religion.invalidateCachedEffects();

  game.updateResources();
}

// Find the production rate associated with a building.
function getProductionRateForBuilding (bld) {
  var togglable = bld.togglable;
  var tunable = bld.tunable;
  if (!togglable && !tunable) {
    return numeric.mul(getValues(gameCopy.resPool.resources,"perTickUI"),0);
  }

  // turn them all off
  bld.on=0;
  recalculateProduction(gameCopy);
  var beforeResources=getValues(gameCopy.resPool.resources,"perTickUI");

  // turn all of our buildings on
  bld.on=bld.val;

  recalculateProduction(gameCopy);
  var afterResources=getValues(gameCopy.resPool.resources,"perTickUI");

  var deltaResources = numeric.sub(afterResources,beforeResources);

  // turn off again, just because
  bld.on=0;

  return deltaResources;
}

function getNullProductionRate () {
  gameCopy.village.clearJobs();  // reset all kittens first

  var temp = getTogglableBuildings();
  var bldlist = temp[0];
  var copybldlist = temp[1];

  for(i in copybldlist) {
    // turn them all off
    copybldlist[i].on=0;
  }

  // set all the quadratic buildings to the appropriate values
  for (i in qBldList) {
    bld = qBldList[i];
    bld.on = bld.val*quadraticBuildingsOn;
  }


  recalculateProduction(gameCopy);
  var beforeResources=getValues(gameCopy.resPool.resources,"perTickUI");

  return beforeResources;
}


// finds a list of all buildables
function getObjects(game) {
  var objects =  [].concat(
    game.bld.meta[0].meta,
    game.science.techs,
    game.workshop.meta[0].meta,
    game.religion.meta[0].meta,
    game.religion.meta[1].meta,
    game.space.programs
  );
  for (var planetIndex in game.space.planets) {
    if (game.space.planets[planetIndex].buildings) {
      objects = objects.concat(game.space.planets[planetIndex].buildings);
    }
  }

  // deal sanely with staging
  for (var i in objects) {
    var ob = objects[i];

    if (ob.stages) {
      if (!ob.stage) {ob.stage=0;}

      //upgrade immediately.
      // I should probably put this check somewhere else, so that I can decide properly whether
      // to upgrade, but here works as a hack.  The actual upgrade procedure is copied from the
      // building.js source file, but is liable to change
      while (ob.stage < ob.stages.length-1 && ob.stages[ob.stage+1].stageUnlocked) {
        // upgrade!  (maybe I should sell first)
        ob.stage = ob.stage || 0;
				ob.stage++;

				ob.val = 0;
      }


      objects[i]=ob.stages[ob.stage];

      // corrects for the fact that the stage 0 amphitheatre doesn't have stageUnlocked set to true
      if(ob.stage == 0 && ob.unlocked && !ob.stages[ob.stage].stageUnlocked) {objects[i].stageUnlocked=true;}
    }
  }

  return objects;
}

function getActivatableButtons() {
  // compile a list of visible buttons
  refreshTabs();
  var buttonList = [];
  for (var pi in gamePage.tabs) {
    var tab = gamePage.tabs[pi];
    if (tab.visible) {

      // generic tabs: bonfire, workshop, science
      for(var bi in tab.buttons) {
        var button = tab.buttons[bi];
        if (button.visible) {
          buttonList.push(button);
        }
      }

      // religion: Order of Light
      if (tab.rUpgradeButtons) {
        for(var bi in tab.rUpgradeButtons) {
          var button = tab.rUpgradeButtons[bi];
          if (button.visible) {
            buttonList.push(button);
          }
        }
      }

      // religion: Ziggurats
      if (tab.zgUpgradeButtons) {
        for(var bi in tab.zgUpgradeButtons) {
          var button = tab.zgUpgradeButtons[bi];
          if (button.visible) {
            buttonList.push(button);
          }
        }
      }

      // space: Ground Control
      if (tab.GCPanel) {
        tab.GCPanel.update(); // no idea why the fuck we need this
        for(var bi in tab.GCPanel.children) {
          var button = tab.GCPanel.children[bi];
          if (button.visible) {
            buttonList.push(button);
          }
        }
      }

      // space;:Planet Panels
      if(tab.planetPanels) {
        for (var panelNumber in tab.planetPanels) {
          for(var bi in tab.planetPanels[panelNumber].children) {
            var button = tab.planetPanels[panelNumber].children[bi];
            if (button.visible) {
              buttonList.push(button);
            }
          }
        }
      }

      //that should be everything (I hope)
    }
  }
  return buttonList;
}

// return the various rates for buildings.  Only include if there is at least
// one of the corresponding building, regardless of unlockness
function getTogglableBuildings () {
  var bldlist = []; // a stored list of buildings, in case things change suddenly
  var copybldlist = [];

  var bldSource = getObjects(gamePage);
  var copybldSource = getObjects(gameCopy);

  qBldList = []; //The quadratic buildings

  for (i in bldSource) {
    bld = bldSource[i];
    copybld = copybldSource[i];

    // skip the quadratic buildings
    if(indexOf(quadraticBuildingList,bld.name)>=0) {
      qBldList.push(bld);
      continue;
    }

    if(bld.val>0 && (bld.togglable||bld.tunable)){
      bldlist.push(bld);
      copybldlist.push(copybld);
    }
  }

  return [bldlist,copybldlist];
}

function getBuildingRates() {
  var returns = [];
  var temp = getTogglableBuildings();
  var bldlist = temp[0];
  var copybldlist = temp[1];

  for(var i=0;i<copybldlist.length;i++) {
    returns.push(getProductionRateForBuilding(copybldlist[i]));
  }

  return [bldlist,returns];
}

// Find the production rate associated with a kitten.
function getProductionRateForKitten (job) {
  gameCopy.village.clearJobs();

  recalculateProduction(gameCopy);
  var beforeResources=getValues(gameCopy.resPool.resources,"perTickUI");

  // assign a new kitten
  gameCopy.village.assignJob(job);

  recalculateProduction(gameCopy);
  var afterResources=getValues(gameCopy.resPool.resources,"perTickUI");

  var deltaResources = numeric.sub(afterResources,beforeResources);
  return deltaResources;
}

// return the various rates for kitten production
function getKittenRates () {
  var joblist = []; // a stored list of jobs, in case things change suddenly
  var returns = [];

  if (gamePage.villageTab.visible) {
    for (var i=0;i<gamePage.village.jobs.length;i++) {
      if (gamePage.village.jobs[i].unlocked) {
        joblist.push(gamePage.village.jobs[i]);
        returns.push(getProductionRateForKitten(gameCopy.village.jobs[i]));
      }
    }
  }
  return [joblist,returns];
}

function zeros (n) {return numeric.mul(range(n),0);}
function unitVector (n,m) {
  var array = zeros(n);
  array[m]=1;
  return array;
}
function unitVectorVal (n,m,val) {
  var array = zeros(n);
  array[m]=val;
  return array;
}
function costToVector(costs) {
  var resourceNames = getValues(gamePage.resPool.resources,"name");
  var out = zeros(resourceNames.length);
  for(var i = 0;i<costs.length;i++) {
    var name = costs[i].name;
    var val = costs[i].val;

    var index = indexOf(resourceNames, name);
    out[index]+=val;
  }
  return out;
}

function getBuildingResearchButtons() {
  // Now construct objects, which contains all of the building objects
  // We're going to cross-reference with the buttons to determine what
  // can be built.

  var buttonList=getActivatableButtons();
  objects =  getObjects(gamePage);

  availablebuttons = [];

  transcendenceResearched = gamePage.religion.getRU("transcendence").researched;
  for (var oi in objects) {
    object = objects[oi];

    if (// the faith part follows the definition of updateEnabled in religion.js
      (object.unlocked && object.upgradable && !object.faith) ||
      (object.stageUnlocked) ||
      (object.unlocked && !object.researched && !object.faith) ||
      (object.faith && !object.researched)||
      (object.faith && object.upgradable && transcendenceResearched)
      ) {
      // buildable in theory
      for (var bi=0;bi<buttonList.length;bi++) {
        bu=buttonList[bi];
        if (bu.name==object.title||bu.name==object.label) {break;}
      }
      if (bi<buttonList.length) {
        availablebuttons.push(bu);
      }
    }
  }

  //console.log(getValues(availablebuttons,"name"));
  return availablebuttons;
}

function getResourceQuantityAndMax () {
  var resList = gamePage.resPool.resources;
  resourceQuantity = getValues(resList,'value');
  resourceQuantity = numeric.max(resourceQuantity,0);

  resourceMax = zeros(resourceQuantity.length);
  for (var i in resourceMax) {
    resourceMax[i]=getResourceMax(resList[i]);
  }
}


resourceGlobalMaxes=false;
function updateResourceGlobalMaxes(){
  // update resourceGlobalMaxes: the most of each resource that we've ever seen
  if (resourceGlobalMaxes===false) {
    // resourceGlobalMaxes will be used as a scaling factor to determine epsilon in the LP
    resourceGlobalMaxes = numeric.add(zeros(gamePage.resPool.resources.length),1);
  }

  for (var i in resourceGlobalMaxes) {
    if (resourceMax[i]==Infinity) {
      resourceGlobalMaxes[i] = Math.max(resourceGlobalMaxes[i],resourceQuantity[i]);
    } else {
      resourceGlobalMaxes[i] = Math.max(resourceGlobalMaxes[i],resourceMax[i]);
    }
  }

  // we also update resourceGlobalMaxes based off expectedResources.  This is useful for technical
  // reasons when performUncappedTrades = false.
  if ('expectedResources' in window) {
    resourceGlobalMaxes = numeric.max(resourceGlobalMaxes,expectedResources);
  }
}

tradeGlobalMaxes=false;
function updateTradeGlobalMaxes() {
  if (tradeGlobalMaxes===false) {

  }
}


function getLPParameters (game) {
  maxKittens = game.village.maxKittens;
  numKittens = game.village.getKittens();

  resourceNullRate = getNullProductionRate(); // important that we run this before buildingrates
  getResourceQuantityAndMax();

  resourceWeightList = [];
  var resourceList = gamePage.resPool.resources;
  for (var i in resourceList) {
    resourceWeightList.push(resourceWeights[resourceList[i].name]);
  }

  var tradesOut = getTradeRates();
  tradeButtons = tradesOut[0];
  tradeReturns = tradesOut[1];
  numTrades = tradeReturns.length;

  var kittensOut = getKittenRates();
  jobList = kittensOut[0];
  jobReturns = kittensOut[1];
  numJobs = jobReturns.length;

  var bldOut = getBuildingRates();
  bldList = bldOut[0];
  bldReturns = bldOut[1];
  numBlds = bldReturns.length;

  numResources = resourceQuantity.length;

  reserveResources = resourceReserve();

  updateResourceGlobalMaxes();
}


function resourceReserve () {
  var out = zeros(resourceMax.length);

  // no reserve until we have at least 5 kittens
  if (gamePage.village.maxKittens<5) {return out;}
  for (var i in out) {
    var res = gamePage.resPool.resources[i];
    if (res.name=="catnip") {out[i]=res.maxValue*catnipReserve;}
  }
  return out;
}

// figures out how many of the indicated trades we can perform before hitting the resource cap for some variable.
function numPurchasableBeforeCap(returnVector) {
  var localResourceQuantity = getValues(gamePage.resPool.resources,'value');
  //use the stored resource max: it shouldn't changes

  var remainingQuotient = numeric.div(numeric.sub(resourceMax,localResourceQuantity),returnVector);
  var returnMin = Infinity;
  for (var i in remainingQuotient) {
    if (0<=remainingQuotient[i]&&remainingQuotient[i]<Infinity) {returnMin = Math.min(remainingQuotient[i],returnMin);}
  }
  return returnMin;
}

function numPurchasable(prices,reserveResources) {
  var costVec = costToVector(prices);
  var localResourceQuantity = getValues(gamePage.resPool.resources,'value');
  localResourceQuantity=numeric.sub(localResourceQuantity,reserveResources);
  localResourceQuantity=numeric.max(localResourceQuantity,0);

  var quotient = numeric.div(localResourceQuantity,costVec);
  for (var i in quotient) {
    if (localResourceQuantity[i]==0) {
      if (costVec[i]==0) {quotient[i]=Infinity;} else {quotient[i]=0;}
    }
  }

  return Math.floor(listMin(quotient));
}
function usesLimitedResources(prices) {
  var costVec = costToVector(prices);
  var resMax = getValues(gamePage.resPool.resources,'maxValue'); //max value of 0 means infinite

  for (i in costVec) {
    if (costVec[i]>0&&resMax[i]>0) {return true;}
  }
  return false;
}

function listSum(array) {
  var count=0;
  for (var i=array.length; i--;) {
    count+=array[i];
  }
  return count;
}
function listMin(array) {
  var out=Infinity;
  for (var i=array.length; i--;) {
    if (array[i]<out) {out=array[i];}
  }
  return out;
}

function getJobButton(job) {
  var blist = gamePage.villageTab.buttons;
  for (var i in blist) {
    if (blist[i].name==job.title) {return blist[i];}
  }
  console.error("Failed to find button for job",job.title);
  return null;
}

function listFloor(list,r) {
  return numeric.mul(numeric.floor(numeric.div(list,r)),r);
}

function canExplore() {
  if (!gamePage.diplomacyTab.visible) {return false;}
  gameCopy.resPool.get("ship").value=gamePage.resPool.get("ship").value; // need to keep track of trade ships
  var race = gameCopy.diplomacy.unlockRandomRace();
  if (race) {
    respawnCopy();
    return true;
  }
  return false;
}

function randomInteger(probs) {
  var normalizedProbs = numeric.div(probs,1.0*listSum(probs));
  var random = Math.random();

  var accumulation = 0;
  for (var i in probs) {
    accumulation += normalizedProbs[i];
    if (accumulation>random) {return i;}
  }
  return -1;
}

/* LINEAR PROGRAM
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
This is straightforward.  It adds up a bunch of things.  We may want
to rescale some of the rows with large numbers.

          trades    jobs    blds    res   buttons
1                   1...1                         <=numKittens
numJobs             -I                            <=0
numTrades -I                                      <=0
numBlds                     -I                    <=0
numBlds                      I                    <=1
numButtons                                -I      <=0
numButtons                                I       <=maximumBuildingPercentage
numRes                              I             <=0.9*maxRes
numRes                              -I            <=epsilon-resourceReserve
numRes    -rates    -jobs*T -blds*T I             <=epsilon+resStart+nullRate*T
numRes                              -I    costs   <=epsilon

objective:                                -bweights
or objective:                       -1/maxres -bweights


In order to make the linear program happier, we may want to rescale some of the rows and
columns.  Perform res->res/maxres  and divide all the res rows by maxres.
This may lead to numbers that are too low...  Maybe rescale trades?
*/
function isBuildable (costVector, maxResources) {
  for (var i in costVector) {
    if (costVector[i]>resourceMax[i]) {return false;}
  }
  return true;
}

function dRound(x) {
  out = [];
  for (var i in x) {
    var num =x[i];
    out.push(+num.toFixed(2));
  }
  return out;
}
function sRound(num) {return +num.toFixed(2);}

function linearProgram (time) {
  if (!time) {time = 0;}
  respawnCopy();
  getResourceQuantityAndMax();
  getLPParameters (gamePage);
  numResources = resourceMax.length;

  // get costs of buildings, but only the ones that are actually buildable.
  buttonList = getBuildingResearchButtons();
  buttonList = buttonList.concat(getExtraButtons());
  buildableButtonList=[];
  var buttonCosts = [];
  for (var i in buttonList) {
    cost = costToVector(buttonList[i].getPrices());
    if (isBuildable(cost,numeric.sub(resourceMax,reserveResources))) {
      buttonCosts.push(cost);
      buildableButtonList.push(buttonList[i]);
    }
  }
  numButtons = buttonCosts.length;

  //evaluate the weights for all the buttons
  buttonWeights = [];
  for (i in buildableButtonList) {
    var weight = buildableWeight(buildableButtonList[i]);
    weight*= 1 + randomBuildingWeightScaling* Math.random();
    buttonWeights.push(weight);
  }

  //List the buttons that we're considering
  console.log("  Considering buttons:", getValues(buildableButtonList,"name"));

  // minimize objective such that matrix.x<=b
  matrixOfInequalities = [];
  objective = [];
  rhs = [];

  // kittens available.
  if (numKittens>0) {
    rhs.push(numKittens);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        numeric.add(zeros(numJobs),1),
        zeros(numBlds),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // jobs need at least 0 kittens
  for(var jobNumber = 0;jobNumber<jobReturns.length;jobNumber++) {
    rhs.push(0);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        unitVectorVal(numJobs,jobNumber,-1),
        zeros(numBlds),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // Positive number of trades
  for(var tradeNumber = 0;tradeNumber<tradeReturns.length;tradeNumber++) {
    rhs.push(0);
    matrixOfInequalities.push([].concat(
        unitVectorVal(numTrades,tradeNumber,-1),
        zeros(numJobs),
        zeros(numBlds),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // buildings need at least 0 fraction active.
  for(var bldNumber = 0;bldNumber<numBlds;bldNumber++) {
    rhs.push(0);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        unitVectorVal(numBlds,bldNumber,-1),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // buildings need at most 1 fraction active.
  for(var bldNumber = 0;bldNumber<numBlds;bldNumber++) {
    rhs.push(1);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        unitVectorVal(numBlds,bldNumber,1),
        zeros(numResources),
        zeros(numButtons)
    ));
  }

  // can't build less than 0 of each button
  for(var buttonNumber = 0;buttonNumber<numButtons;buttonNumber++) {
    rhs.push(1e-8);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        zeros(numBlds),
        zeros(numResources),
        unitVectorVal(numButtons,buttonNumber,-1)
    ));
  }

  // can't build more than 1.2 of each button
  for(var buttonNumber = 0;buttonNumber<numButtons;buttonNumber++) {
    rhs.push(maximumBuildingPercentage);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        zeros(numBlds),
        zeros(numResources),
        unitVectorVal(numButtons,buttonNumber,1)
    ));
  }

  // can't store more resources than our max
  for(var resNumber = 0;resNumber<numResources;resNumber++) {
    if (resourceMax[resNumber]/resourceGlobalMaxes[resNumber]<Infinity) {

      // check if faith
      if (ignoreFaithCap && gamePage.resPool.resources[resNumber].name=='faith') {continue;}

      rhs.push(resourceMax[resNumber]);
      matrixOfInequalities.push([].concat(
          zeros(numTrades),
          zeros(numJobs),
          zeros(numBlds),
          unitVectorVal(numResources,resNumber,1),
          zeros(numButtons)
      ));
    }
  }

  // need at least epsilon of each resource
  for(var resNumber = 0;resNumber<numResources;resNumber++) {
    rhs.push(1e-5-reserveResources[resNumber]/resourceGlobalMaxes[resNumber]);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        zeros(numBlds),
        unitVectorVal(numResources,resNumber,-1),
        zeros(numButtons)
    ));
  }

  // can't end up with more resources than we produce
  tradeT = numeric.transpose(tradeReturns);
  if (jobReturns.length>0) {jobT = numeric.transpose(jobReturns);} else {jobT=[];for(var i in resourceNullRate) {jobT.push([]);}}
  if (bldReturns.length>0) {bldT = numeric.transpose(bldReturns);} else {bldT=[];for(var i in resourceNullRate) {bldT.push([]);}}
  buttonT = numeric.transpose(buttonCosts);

  for(var i=0;i<resourceNullRate.length;i++) {
    // if we have infinite of this type of resource, ignore this line of the linear program
    if (resourceQuantity[i]>infiniteResources) {continue;}

    // filter which resources we include: some of them don't work.
    if (resourceQuantity[i]<=0 && resourceNullRate[i]<0){
      rhs.push(1e-5);
    } else {
      rhs.push(resourceQuantity[i]/resourceGlobalMaxes[i]+resourceNullRate[i]*time*ticksPerSecond/resourceGlobalMaxes[i]+1e-5);
    }
    matrixOfInequalities.push([].concat(
      numeric.mul(numeric.div(tradeT[i],resourceGlobalMaxes[i]),-1.0*tradeScaling),
      numeric.mul(numeric.div(jobT[i],resourceGlobalMaxes[i]),-1*time*ticksPerSecond),
      numeric.mul(numeric.div(bldT[i],resourceGlobalMaxes[i]),-1*time*ticksPerSecond),
      unitVectorVal(numResources,i,1),
      zeros(numButtons)
    ));
  }

  // resources must be distributed to buildings
  for(var resNumber = 0;resNumber<numResources;resNumber++) {
    rhs.push(1e-5-reserveResources[resNumber]/resourceGlobalMaxes[resNumber]);
    matrixOfInequalities.push([].concat(
        zeros(numTrades),
        zeros(numJobs),
        zeros(numBlds),
        unitVectorVal(numResources,resNumber,-1),
        numeric.div(buttonT[resNumber],resourceGlobalMaxes[resNumber])
    ));
  }

  // The contribution to the objective for gathering resources.  Resources are scored even if they are spent
  // on buildings.
  var resObjective;
  if (scoreAccumulatedResources) {
    resObjective = numeric.mul(-1.0,resourceWeightList);
  } else {
    resObjective = zeros(numResources);
  }

  // Finished all the rows.  Construct the objective.
  objective = [].concat(
    zeros(numTrades),
    zeros(numJobs),
    zeros(numBlds),
    resObjective,
    numeric.mul(buttonWeights,-1) //previously numeric.add(zeros(numButtons),-1)
  );

  // Run the linear program
  solution = numeric.solveLP(objective,matrixOfInequalities,rhs);
  if(solution.message=="Infeasible") {
    console.log("no solution to the linear program found: defaulting to farming.");
    tradesToDo=zeros(numTrades);
    realTradesToDo=zeros(numTrades);
    jobsToDo=zeros(numJobs);
    bldsToDo=zeros(numBlds);
    expectedResources=zeros(numResources);
    buttonCompleteness=zeros(numButtons);

    // everyone should be farming.  This is overkill, but it might work better than letting kittens starve
    for (var i in jobsToDo) {
      if (jobList[i].name=="farmer") {jobsToDo[i]=numKittens;}
    }

    // It's possible the the quadratic buildings broke things.  In case this is true, disable them for an hour.
    quadraticBuildingsOn=false;
    setInterval(function () {quadraticBuildingsOn=true;return;},60*60*1000);

  } else {
    // turn the solution into actual useful quantities
    ci = 0;
    realTradesToDo = solution.solution.slice(ci,ci + numTrades); ci+=numTrades;
    realTradesToDo = numeric.mul(realTradesToDo,tradeScaling);
    tradesToDo = numeric.ceil(numeric.sub(realTradesToDo,tradeThreshold)); // Integerize
    jobsToDo = solution.solution.slice(ci,ci + numJobs); ci+=numJobs;
    bldsToDo = solution.solution.slice(ci,ci + numBlds); ci+=numBlds;
    expectedResources = solution.solution.slice(ci,ci+numResources);ci+=numResources;
    buttonCompleteness = solution.solution.slice(ci,ci+numButtons);ci+=numButtons;
  }

  //console.log("tradesToDo",tradesToDo);
  //console.log("jobsToDo",dRound(jobsToDo));
  //console.log("expectedResources",dRound(expectedResources));
  //console.log("buttonCompleteness",dRound(buttonCompleteness));

  // generate the list of things we are allowed to build
  allowedButtons = [];
  allowedButtonCosts = [];
  for (var i in buildableButtonList) {
    if (buttonCompleteness[i]>=1.0) {
      allowedButtons.push(buildableButtonList[i]);
      allowedButtonCosts.push(buttonCosts[i]);
    }
  }


  // Now print the results
  console.log("  Planned constructions:");
  for (var i in buttonCompleteness) {
    if (buttonCompleteness[i]>0.001) {
      console.log("   ",buildableButtonList[i].name,":",Math.round(100*buttonCompleteness[i]),"%");
    }
  }

  console.log("  Buildings used:");
  for(var i in bldsToDo) {
    if(bldsToDo[i]>1.0e-4) {
      console.log("   ",bldList[i].label||bldList[i].title,":",Math.round(100*bldsToDo[i]), "%");
    }
  }

  //console.log("tradesToDo",tradesToDo);
  console.log("  Job distribution:");
  for (var i in jobsToDo) {
    if(jobsToDo[i]>0.005) {console.log("   ",jobList[i].title,":",sRound(jobsToDo[i]));}
  }

  console.log("  Trades:");
  //printTrades();
  printRealTrades();

  //console.log("  Partial constructions:")
  //for (var i in allowedButtons) {
  //  console.log("   ",allowedButtons[i].name);
  //}
  //console.log("buttonCompleteness",dRound(buttonCompleteness));

  return;
}

/* MAIN LOOP
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
**********************************************************************
There are a few main loops:
1 activates whenever we build a building or every hour.
    Update everything.
    Figure out what the next building we should be is
    Runs loop 2.
2 activates every 10 minutes or so.
    Run the second linear program
    run loop 3
3 activates every second or so
    try to make trades that we need to do
    update the distribution of jobs and buildings.
4 activates every second or so and clicks on log events
5 activates every second or so and converts faith if close to the cap
*/
function getExtraButtons() {
  out = [];
  if (!gamePage.bld.get("library").unlocked) {
    bb = {
      name:"Buying extra wood",
      getPrices:function () {return [{name:"wood",val:10}];},
      onClick: function(){}
    };
    out.push(bb);
  }

  if (gamePage.resPool.get("megalith").value < 10 && !gamePage.bld.get("ziggurat").unlocked) {
    bb = {
      name:"Buying extra megaliths",
      getPrices:function () {return [{name:"megalith",val:10}];},
      onClick: function(){}
    };
    out.push(bb);
  }

  // explore.  Note that
  if (canExplore()) {
    bb = gamePage.diplomacyTab.exploreBtn;
    out.push(bb);
  }


  numShips = gamePage.resPool.get("ship").value;

  // discourage purchase of tankers
  desiredShips = Math.max((tradeShipMultiplier+1)*numShips,5);
  bb = {
    name:"Buying some trade ships",
    getPrices:function () {return [{name:"ship",val:desiredShips}];},
    onClick: function(){}
  };
  out.push(bb);

  return out;
}

function planLoop () {
  clearTimeout(planLoopTimeout);planLoopTimeout=false;
  if (!linearKittensOn) {return;}

  var startTime = new Date().getTime();

  // pause if we need to
  var priorIsPaused=false;
  if (pauseDuringCalculations) {
    priorIsPaused = gamePage.isPaused;
    if (!gamePage.isPaused) {gamePage.togglePause();}
  }

  console.log ("\nPLANNING LOOP");
  planningloopseason = gamePage.calendar.season;
  planningloopweather = gamePage.calendar.weather;

  refreshTabs();

  buttonList = getBuildingResearchButtons();
  buttonList = buttonList.concat(getExtraButtons());

  console.log("  Attempting linear program.");

  out = linearProgram(planningInterval);

  var endTime = new Date().getTime();
  console.log('  Planning loop completed in ' +(endTime-startTime)+'ms');

  if (linearKittensOn) {planLoopTimeout=setTimeout(planLoop, planningInterval*1000);}
  // unpause if we need to
  if (pauseDuringCalculations) {
    if (priorIsPaused != gamePage.isPaused) {
      gamePage.togglePause();
    }
  }
}

function printTrades() {
  for (var i in tradesToDo) {
    if (tradesToDo[i]>0) {
      if (tradeButtons[i].race) {
        console.log("   ",tradeButtons[i].race.name,":",tradesToDo[i]);
      } else {
        console.log("   ",tradeButtons[i].name,":",tradesToDo[i]);
      }
    }
  }
}
function printRealTrades() {
  for (var i in realTradesToDo) {
    if (tradesToDo[i]>tradeThreshold) {
      if (tradeButtons[i].race) {
        console.log("   ",tradeButtons[i].race.name,":",sRound(realTradesToDo[i]));
      } else {
        console.log("   ",tradeButtons[i].name,":",sRound(realTradesToDo[i]));
      }
    }
  }
}

// This will perform the specified number of trades, regardless of what the button is.
function executePerformTrades(button, canBuild) {
  if (button.craftName) {
    //console.log("crafting resources.");
    gamePage.craft(button.craftName,canBuild);
  } else if (button.race) {
    // continue if Leviathans and duration is not positive, because this button can disappear
    if ('duration' in button.race && (button.race.duration==0 || button.race.duration<0)) {return 0;}

    //console.log("trading multiple");
    button.tradeMultiple(canBuild);
  } else {
    //try to trade one at a time...
    //console.log(button.name, canBuild);
    for (var i=0;i<canBuild;i++) {
      // hunts need to be treated differently, for some reason.
      if (button.name=="Send hunters") {
        button.payPrice();
        gamePage.villageTab.sendHunterSquad();
      } else {
        if (button.handler) {button.handler(button);} else {button.onClick(genericEvent);}
      }
    }
  }
  return canBuild;
}

// Do this every second
loop3Counter = 0;
function executeLoop () {
  if (!linearKittensOn) {return;}

  console.log ("\nEXECUTION LOOP");
  loop3Counter = (loop3Counter+1)%10;

  // ACTIVATE BUILDINGS
  // set a bunch of buildings to the appropriate state.  Skip the buttons.
  for(var i in bldList) {
    var bld = bldList[i];
    var fOn = bldsToDo[i];
    if (!bld.tunable) {
      // all on or all off
      if  (fOn>loop3Counter/10) {bld.on=bld.val;} else {bld.on=0;}
    } else {
      //actually tunable
      var shouldBeOn = fOn*bld.val;
      var alwaysOn = Math.floor(shouldBeOn);
      var lastone = shouldBeOn-alwaysOn;
      if  (lastone>loop3Counter/10) {bld.on=alwaysOn+1;} else {bld.on=alwaysOn;}
    }
  }

  // set the quadratic buildings to the appropriate state
  for (i in qBldList) {
    bld = qBldList[i];
    bld.on = bld.val*quadraticBuildingsOn;
  }

  // ASSIGN KITTENS
  // do so cleverly, or something, by minimizing number of operations.
  numKittens = gamePage.village.getKittens();
  var toJobs = numeric.max(numeric.floor(jobsToDo),0);
  var expectedKittens = Math.round(listSum(jobsToDo));
  var totalJobs = listSum(toJobs);
  if (totalJobs>numKittens) { //game.village.getKittens();
    console.error("  Too few kittens for assigned jobs.");
    toJobs=numeric.mul(0,toJobs);
    expectedKittens=0;
  }

  //Override if below the catnip reserve, we have at least five kittens and access to farmers.
  //Ignore the other reserves for now.
  //Every kitten should forget his job, so they all get treated as unaccounted kittens.
  var catnipRes = gamePage.resPool.get('catnip');
  if(
    catnipRes.value<catnipReserve*catnipRes.maxValue &&
    gamePage.village.maxKittens>=5 &&
    gamePage.science.get("agriculture").researched
    ) {
    console.log("  Below catnip reserve: assigning kittens to farming.");
    toJobs = numeric.mul(0,toJobs);
    expectedKittens=0;
    totalJobs=0;
  }

  // randomly assign the last expected kittens
  var randomKittens = expectedKittens-totalJobs;
  deltaJobs = numeric.sub(jobsToDo,toJobs);
  //console.log("jobs:",jobsToDo,deltaJobs, toJobs);

  for (i=0;i<randomKittens;i++) {
    var randomJob = randomInteger(deltaJobs);
    toJobs[randomJob]+=1;
  }

  var extraKittens = numKittens-expectedKittens;

  // remove kittens from jobs
  for ( i in toJobs) {
    idealJobs = toJobs[i];
    job = jobList[i];
    if (job.value>idealJobs) {
      getJobButton(job).unassignJobs(job.value-idealJobs);
      getJobButton(job).update();
    }
  }
  // add kittens to jobs
  for ( i in toJobs) {
    idealJobs = toJobs[i];
    job = jobList[i];
    if (job.value<idealJobs) {
      getJobButton(job).assignJobs(idealJobs-job.value);
      getJobButton(job).update();
    }
  }
  // any remaining kittens become farmers if available and something else otherwise
  var foundFarmers=false;
  if (extraKittens>0) {
    for (i in toJobs) {
      job = jobList[i];
      if (job.name=="farmer") {
        foundFarmers=true;
        getJobButton(job).assignJobs(extraKittens);
        toJobs[i]+=extraKittens;
        getJobButton(job).update();
        break;
      }
    }
    if (!foundFarmers) {
      job = jobList[0];
      toJobs[0]+=extraKittens;
      getJobButton(job).assignJobs(extraKittens);
      getJobButton(job).update();
    }

  }
  //Print the list of assigned jobs
  console.log("  Jobs assigned:");
  for (var i in jobsToDo) {
    if(toJobs[i]>0) {console.log("   ",jobList[i].title,":",toJobs[i]);}
  }


  // PERFORM TRADES
  console.log("  Remaining trades:");
  printTrades();

  // get the new resource consumption rates.  We'll add this to the buffer to fix issue #11.
  recalculateProduction(gamePage);
  var resourcesPerTick=getValues(gamePage.resPool.resources,"perTickUI");
  var resourcesPerExecutionLoop = numeric.mul(resourcesPerTick, Math.ceil(executionInterval * ticksPerSecond) );
  var consumptionBuffer = numeric.max(0,numeric.mul(resourcesPerExecutionLoop,-1.0));
  var currentResources = getValues(gamePage.resPool.resources,'value');
  consumptionBuffer = numeric.min(currentResources,consumptionBuffer);
  //console.log(reserveResources);
  //console.log(consumptionBuffer);
  //console.log(numeric.add(reserveResources,consumptionBuffer) );

  // try to do all the trades.
  var canPerformBadTrades = false;
  var madeTrade = false;

  while (true) {
    //console.log("starting trade loop.  bad trades:", canPerformBadTrades);
    madeTrade = false;

    for (var i in tradesToDo) {
      //console.log(tradesToDo[i]);
      if (tradesToDo[i]<=0) {continue;}

      // atempt to perform the trade.
      var button = tradeButtons[i];
      var costs = button.getPrices();
      var canBuild = numPurchasable(costs, numeric.add(reserveResources,consumptionBuffer) );
      if (canBuild==0) {continue;}

      var goodBuilds = numPurchasableBeforeCap(tradeReturns[i]); // real value geq 0
      if (!canPerformBadTrades && goodBuilds <1) {continue;} // there are builds, but not any that won't pass the resource cap.

      // at this point, check to see whether performUncappedTrades prevents this trade
      if (!performUncappedTrades && !usesLimitedResources(costs)) {continue;}

      //console.log(costs,canBuild);
      canBuild = Math.min(canBuild,tradesToDo[i]);
      if (!canPerformBadTrades) {
        canBuild = Math.min(canBuild,Math.floor(goodBuilds));
      }
      //console.log("performing ", canBuild, " trades of ",goodBuilds, " good trades of ",button.name,button.race);

      if (canBuild<=0) {continue;}


      tradesToDo[i]-=canBuild;
      //console.log(currenttemp = getValues(gamePage.resPool.resources,'value'));
      executePerformTrades(button,canBuild);
      //console.log(numeric.sub(getValues(gamePage.resPool.resources,'value'),currenttemp));
      madeTrade = true;

      // this is the only bad trade we are allowed to do in this loop
      if (canPerformBadTrades) {canPerformBadTrades=false; break;}
    }

    // If we can't make any trades, including the bad ones, stop trading.
    // If we didn't make any good trades, start considering the bad ones.
    if (!madeTrade && canPerformBadTrades) {break;}
    if (!madeTrade) {canPerformBadTrades=true;}
  }

  // BUILD BUILDINGS
  // Check whether we can build any of the the buildings
  currentlyAllowedButtons = allowedButtons;
  allowedButtons=[];
  if (autoBuy) { // if autoBuy is off, we can ignore this entire step.
    for (i in currentlyAllowedButtons) {
      var buildButton = currentlyAllowedButtons[i];
      buttonPrices=buildButton.getPrices();
      var canBuildNow = numPurchasable(buttonPrices,reserveResources);
      if (canBuildNow>0) {
        // try to build it.
        console.log("  Constructing",buildButton.name);
        buildButton.onClick(genericEvent);
        event = genericEvent; // this is an ugly hack to compensate for the definition of onClick for the Research Vessel program
        if (constructionResetsPlanning) {
          if (linearKittensOn) {setTimeout(planLoop,1);}
          return;
        }
      } else {
        //can't build it
        allowedButtons.push(buildButton);
      }
    }
  }
  if (allowRepeatedBuilds) {allowedButtons=currentlyAllowedButtons;}


  //If we changed season, we should run loop2 again.
  if(planningloopseason != gamePage.calendar.season||planningloopweather!=gamePage.calendar.weather) {
    console.log("  Season changed. Running the planning loop.");
    if (linearKittensOn) {setTimeout(planLoop,1);}
  }
}

// in a new game, click the gather catnip button
function autoCatnipFunction() {
  if (gamePage.bld.get("field").val>0) {return;}
  var tab;

  for (var i in gamePage.tabs) {
    tab = gamePage.tabs[i];
    if (tab.tabName == "Bonfire") {break;}
  }
  buttons = tab.buttons;
  if (buttons.length==0) {return;}
  for (var b in buttons) {
    if (buttons[b].name=="Gather catnip") {
      buttons[b].handler(buttons[b]);
    }
  }
}

//starclick and autopray by Browsing_From_Work from https://www.reddit.com/r/kittensgame/comments/2eqlt5/a_few_kittens_game_scripts_ive_put_together/
//clearInterval(starClick);clearInterval(autoPray);
function starClickFunction () { $("#observeBtn").click(); }
function autoPrayFunction() {  //heavily modified autopray
  // exit if we haven't unlocked the relgion tab yet
  if (!gamePage.religionTab.visible) {return;}

  // no spending faith if we're saving up for it.
  if (autoBuy) {
    if ('buildableButtonList' in window) {
      for (var i in buildableButtonList) {
        if (buttonCompleteness[i]>0.9) {// maybe we should be less conservative than this?
          // this is a building we are going to make
          var listOfCosts=buildableButtonList[i].getPrices();
          for (var j in listOfCosts) {
            if (listOfCosts[j].name=='faith') {return;}
          }
        }
      }
    }
  }

  var faith = gamePage.resPool.get('faith');
  var accumulatedFaith = gamePage.religion.faith;
  var faithRatio = gamePage.religion.faithRatio;
  if (faith.value > 0.9*faith.maxValue || faith.value > accumulatedFaith/faithRatio + 1) {
    // spending faith early is a good idea when we have low faith
    gamePage.religionTab.praiseBtn.onClick();
  }
}

linearKittensOn = false;
starClick=false;
autoPray=false;
autoCatnip=false;
executeInterval = false;
planLoopTimeout=false;
function startLinearKittens() {
  if (linearKittensOn) {console.error("linearKittens already started."); return;}

  linearKittensOn = true;
  autoCatnip = setInterval(autoCatnipFunction,2000);
  starClick = setInterval(starClickFunction, 5*1000);
  autoPray = setInterval(autoPrayFunction,1*1000);

  respawnCopy();
  planLoop();
  executeInterval = setInterval(executeLoop,executionInterval*1000);
}

function stopLinearKittens() {
  linearKittensOn = false;
  clearInterval(autoCatnip);
  clearInterval(starClick);
  clearInterval(autoPray);
  clearInterval(executeInterval);
}

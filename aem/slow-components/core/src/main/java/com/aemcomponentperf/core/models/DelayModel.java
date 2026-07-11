package com.aemcomponentperf.core.models;

import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.models.annotations.Default;
import org.apache.sling.models.annotations.DefaultInjectionStrategy;
import org.apache.sling.models.annotations.Model;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.PostConstruct;
import javax.inject.Inject;

@Model(
    adaptables = SlingHttpServletRequest.class,
    defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL
)
public class DelayModel {

    private static final Logger log = LoggerFactory.getLogger(DelayModel.class);

    @Inject
    @Default(intValues = 0)
    private int delaySeconds;

    @PostConstruct
    protected void init() {
        try {
            log.debug("DelayModel: simulating {}s backend delay", delaySeconds);
            Thread.sleep(delaySeconds * 1000L);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
